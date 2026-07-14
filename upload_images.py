import zipfile, xml.etree.ElementTree as ET, os, re
from pathlib import Path
from openpyxl import load_workbook

xlsx = sorted(Path.home().glob('Downloads/*.xlsx'), key=lambda x: x.stat().st_size, reverse=True)[0]
print(f'Excel: {xlsx.name}')

wb = load_workbook(xlsx, read_only=True, data_only=True)
ws = wb.active
row_to_sku = {}
for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
    sku = str(row[0]).strip() if row[0] else ''
    if sku and sku != 'None':
        row_to_sku[i + 1] = sku
print(f'SKUs: {len(row_to_sku)}')

out = Path('/tmp/rivero-upload/products')
out.mkdir(parents=True, exist_ok=True)
saved = 0

with zipfile.ZipFile(xlsx) as z:
    names = z.namelist()
    drawings = [n for n in names if 'drawings/drawing' in n and n.endswith('.xml')]
    print(f'Drawings: {drawings}')
    for dp in drawings:
        rp = dp.replace('drawings/', 'drawings/_rels/') + '.rels'
        if rp not in names:
            continue
        rels = ET.fromstring(z.read(rp))
        rid_img = {r.get('Id'): os.path.basename(r.get('Target', '')) for r in rels}
        draw = ET.fromstring(z.read(dp))
        ns = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
        na = 'http://schemas.openxmlformats.org/drawingml/2006/main'
        nr = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
        anchors = draw.findall(f'.//{{{ns}}}oneCellAnchor') + draw.findall(f'.//{{{ns}}}twoCellAnchor')
        print(f'Anchors en {dp}: {len(anchors)}')
        for anc in anchors:
            fe = anc.find(f'{{{ns}}}from')
            pic = anc.find(f'.//{{{ns}}}pic')
            if fe is None or pic is None:
                continue
            re_el = fe.find(f'{{{ns}}}row')
            blip = pic.find(f'.//{{{na}}}blip')
            if re_el is None or blip is None:
                continue
            dr = int(re_el.text)
            rid = blip.get(f'{{{nr}}}embed')
            img = rid_img.get(rid, '')
            ip = f'xl/media/{img}'
            if ip not in names:
                continue
            sku = row_to_sku.get(dr) or row_to_sku.get(dr - 1)
            if not sku:
                continue
            safe = re.sub('[^A-Za-z0-9._-]', '_', sku)
            ext = os.path.splitext(img)[1] or '.png'
            (out / f'{safe}{ext}').write_bytes(z.read(ip))
            saved += 1
            if saved % 50 == 0:
                print(f'  {saved} extraidas...')

print(f'Total: {saved} imagenes guardadas en /tmp/rivero-upload/products/')
