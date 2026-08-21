(function () {
'use strict';

var STORAGE_KEY = 'rvcart_v1';
var WA_PHONE = '15558016189';

/* ── State ── */
var state = (function () {
  try { var s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return { items: [] };
})();

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
function totalCount() { return state.items.reduce(function (s, i) { return s + i.qty; }, 0); }
function totalValue() { return state.items.reduce(function (s, i) { return s + i.qty * i.price; }, 0); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function lang() { return window.RV_LANG || 'es'; }
function isEN() { return lang() === 'en'; }

/* ── CSS ── */
var s = document.createElement('style');
s.textContent = '.rv-cart-btn{display:block;width:100%;padding:8px 0;border:0;border-radius:999px;background:#235CF2;color:#fff;font-family:\'Jost\',\'Century Gothic\',system-ui,sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-top:8px;transition:filter .15s,transform .1s}.rv-cart-btn:hover{filter:brightness(1.12)}.rv-cart-btn:active{transform:scale(.96)}.rv-cart-btn.rv-added{background:#04B704}.rv-cart-fab{position:fixed;bottom:24px;left:16px;z-index:9990;width:52px;height:52px;border-radius:50%;background:#235CF2;color:#fff;border:0;cursor:pointer;box-shadow:0 4px 16px rgba(35,92,242,.4);transition:transform .15s,filter .15s;display:flex;align-items:center;justify-content:center}.rv-cart-fab:hover{filter:brightness(1.1);transform:scale(1.05)}.rv-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;background:#FF8001;color:#fff;font-size:10px;font-weight:900;border-radius:999px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}.rv-badge.hidden{display:none}.rv-overlay{display:none;position:fixed;inset:0;z-index:9995;background:rgba(8,8,8,.45);backdrop-filter:blur(2px)}.rv-overlay.open{display:block}.rv-drawer{position:fixed;top:0;right:-420px;bottom:0;width:100%;max-width:400px;z-index:9996;background:#fff;display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,.18);transition:right .28s cubic-bezier(.4,0,.2,1);font-family:\'Jost\',\'Century Gothic\',system-ui,sans-serif}.rv-drawer.open{right:0}.rv-dhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eef0f3;background:#235CF2;color:#fff;flex-shrink:0}.rv-dhead h2{font-size:15px;font-weight:800;margin:0}.rv-dclose{background:rgba(255,255,255,.2);border:0;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}.rv-dbody{flex:1;overflow-y:auto}.rv-dempty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;color:#9aa0b8;text-align:center;gap:12px;font-size:14px}.rv-dempty svg{opacity:.3}.rv-item{display:flex;align-items:flex-start;gap:12px;padding:14px 20px;border-bottom:1px solid #eef0f3}.rv-item-img{width:52px;height:52px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#f4f6fb;border:1px solid #e8eaf0;display:flex;align-items:center;justify-content:center}.rv-item-img img{width:100%;height:100%;object-fit:contain;padding:2px}.rv-item-body{flex:1;min-width:0}.rv-item-name{font-size:12.5px;font-weight:600;color:#1a1e2e;line-height:1.35}.rv-item-sku{font-size:10px;color:#9aa0b8;font-family:monospace;margin-top:2px}.rv-item-foot{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}.rv-qbtn{width:24px;height:24px;border-radius:50%;border:1.5px solid #dee1e6;background:#fff;font-size:15px;cursor:pointer;color:#235CF2;display:flex;align-items:center;justify-content:center;flex-shrink:0}.rv-qval{font-size:13px;font-weight:700;min-width:18px;text-align:center}.rv-item-price{font-size:12px;font-weight:700;color:#235CF2;font-variant-numeric:tabular-nums}.rv-remove{margin-left:auto;background:0;border:0;color:#c2000b;font-size:11px;cursor:pointer;padding:2px 4px;flex-shrink:0}.rv-dfoot{border-top:2px solid #eef0f3;padding:16px 20px;flex-shrink:0;background:#f8f9fc}.rv-dtotal{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}.rv-dtotal-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9aa0b8}.rv-dtotal-val{font-size:20px;font-weight:900;color:#235CF2;font-variant-numeric:tabular-nums}.rv-dactions{display:flex;flex-direction:column;gap:8px}.rv-export-row{display:flex;gap:8px}.rv-ebtn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;border:1.5px solid #dee1e6;background:#fff;color:#26282c;transition:background .15s;text-decoration:none}.rv-ebtn:hover{background:#f0f2f8}.rv-ebtn-wa{background:#25D366;border-color:#25D366;color:#fff;justify-content:center}.rv-ebtn-wa:hover{filter:brightness(1.08);background:#25D366}.rv-remind-backdrop{position:fixed;inset:0;z-index:9993;background:rgba(8,8,8,.4);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s;pointer-events:none}.rv-remind-backdrop.rv-remind--in{opacity:1;pointer-events:auto}.rv-remind{position:fixed;top:50%;left:50%;z-index:9994;transform:translate(-50%,-46%);opacity:0;transition:transform .38s cubic-bezier(.34,1.2,.64,1),opacity .3s;pointer-events:none;width:min(320px,90vw)}.rv-remind.rv-remind--in{transform:translate(-50%,-50%);opacity:1;pointer-events:auto}.rv-remind-inner{background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(8,8,8,.28);padding:28px 24px 20px;position:relative;font-family:\'Jost\',\'Century Gothic\',system-ui,sans-serif;text-align:center}.rv-remind-x{position:absolute;top:12px;right:14px;background:rgba(0,0,0,.06);border:none;color:#6b7280;cursor:pointer;font-size:14px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .15s}.rv-remind-x:hover{background:rgba(0,0,0,.12)}.rv-remind-icon{font-size:36px;margin-bottom:12px;display:block}.rv-remind-title{font-size:17px;font-weight:900;color:#1a1e2e;margin-bottom:6px;letter-spacing:-.01em}.rv-remind-body{font-size:13px;color:#6b7280;line-height:1.55;margin-bottom:20px}.rv-remind-cta{display:block;width:100%;background:#235CF2;color:#fff;border:none;border-radius:99px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s;margin-bottom:8px}.rv-remind-cta:hover{filter:brightness(1.1)}.rv-remind-skip{background:none;border:none;color:#9aa0b8;font-size:12px;cursor:pointer;font-family:inherit;padding:4px 8px;transition:color .15s}.rv-remind-skip:hover{color:#1a1e2e}.back{display:inline-flex!important;align-items:center;gap:8px;font-size:14px!important;font-weight:700!important;color:#fff!important;background:#235CF2;padding:10px 22px!important;border-radius:999px;text-decoration:none;margin:20px clamp(16px,4vw,32px) 0!important;transition:filter .15s;box-shadow:0 3px 14px rgba(35,92,242,.3);max-width:none!important}.back:hover{filter:brightness(1.1);color:#fff!important}.rv-nl-wrap{margin-top:20px;padding:20px 22px;background:rgba(35,92,242,.06);border-radius:12px;border:1px solid rgba(35,92,242,.14)}.rv-nl-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;color:#235CF2;margin-bottom:8px}.rv-nl-desc{font-size:13px;color:var(--fg2,#6b7280);margin:0 0 12px;line-height:1.5}.rv-nl-row{display:flex;gap:8px;flex-wrap:wrap}.rv-nl-input{flex:1;min-width:160px;padding:10px 14px;border:1.5px solid rgba(35,92,242,.25);border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a1e2e}.rv-nl-input:focus{border-color:#235CF2}.rv-nl-btn{padding:10px 18px;background:#235CF2;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:filter .15s}.rv-nl-btn:hover{filter:brightness(1.1)}.rv-nl-thanks{font-size:13px;font-weight:600;color:#04B704;margin-top:10px;display:none}';
document.head.appendChild(s);

/* ── FAB ── */
var fabEl, badgeEl;
(function () {
  var fab = document.createElement('button');
  fab.className = 'rv-cart-fab';
  fab.setAttribute('aria-label', 'Carrito');
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61H19a2 2 0 001.99-1.81L22 6H6"/></svg><span class="rv-badge hidden">0</span>';
  fab.onclick = toggleDrawer;
  document.body.appendChild(fab);
  fabEl = fab;
  badgeEl = fab.querySelector('.rv-badge');
  refreshBadge();
})();

function refreshBadge() {
  if (!badgeEl) return;
  var n = totalCount();
  badgeEl.textContent = n;
  if (n > 0) badgeEl.classList.remove('hidden'); else badgeEl.classList.add('hidden');
}

/* ── Drawer ── */
var overlayEl, drawerEl;
(function () {
  var ov = document.createElement('div');
  ov.className = 'rv-overlay';
  ov.onclick = closeDrawer;
  document.body.appendChild(ov);
  overlayEl = ov;

  var dr = document.createElement('div');
  dr.className = 'rv-drawer';
  dr.innerHTML = '<div class="rv-dhead"><h2 id="rv-dtitle">Carrito</h2><button class="rv-dclose" id="rv-dclose">&#x2715;</button></div><div class="rv-dbody" id="rv-dbody"></div><div class="rv-dfoot" id="rv-dfoot"></div>';
  document.body.appendChild(dr);
  drawerEl = dr;
  document.getElementById('rv-dclose').onclick = closeDrawer;
})();

function toggleDrawer() { if (drawerEl.classList.contains('open')) closeDrawer(); else openDrawer(); }
function openDrawer() { renderDrawer(); drawerEl.classList.add('open'); overlayEl.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { drawerEl.classList.remove('open'); overlayEl.classList.remove('open'); document.body.style.overflow = ''; }

var CART_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61H19a2 2 0 001.99-1.81L22 6H6"/></svg>';
var XLS_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>';
var PDF_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>';
var WA_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

function buildWaLink() {
  var en = isEN();
  var lines = [en ? '🛒 *Order — Rivero*' : '🛒 *Pedido — Rivero*', '━━━━━━━━━━━━━━━━━━━━━'];
  state.items.forEach(function (item) {
    lines.push('• SKU ' + item.sku + ' — ' + item.name + ' \xd7 ' + item.qty + ' = ' + fmt(item.price * item.qty));
  });
  lines.push('━━━━━━━━━━━━━━━━━━━━━');
  lines.push('💰 Total: ' + fmt(totalValue()));
  return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(lines.join('\n'));
}

function renderDrawer() {
  var en = isEN();
  var title = document.getElementById('rv-dtitle');
  var body = document.getElementById('rv-dbody');
  var foot = document.getElementById('rv-dfoot');
  if (title) title.textContent = en ? 'Cart' : 'Carrito';
  if (!body || !foot) return;

  if (state.items.length === 0) {
    body.innerHTML = '<div class="rv-dempty"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61H19a2 2 0 001.99-1.81L22 6H6"/></svg><span>' + (en ? 'Your cart is empty' : 'Tu carrito est\xe1 vac\xedo') + '</span></div>';
    foot.innerHTML = '';
    return;
  }

  var html = '';
  state.items.forEach(function (item) {
    var imgHtml = item.img
      ? '<img src="' + esc(item.img) + '" alt="" loading="lazy">'
      : '<svg width="24" height="24" viewBox="0 0 32 32" fill="none"><rect x="4" y="10" width="24" height="14" rx="2" fill="#c8cdd8"/><rect x="4" y="4" width="24" height="5" rx="1.5" fill="#b0b7c6"/></svg>';
    html += '<div class="rv-item">';
    html += '<div class="rv-item-img">' + imgHtml + '</div>';
    html += '<div class="rv-item-body">';
    html += '<div class="rv-item-name">' + esc(item.name) + '</div>';
    html += '<div class="rv-item-sku">SKU ' + esc(item.sku) + '</div>';
    html += '<div class="rv-item-foot">';
    html += '<button class="rv-qbtn rv-dec" data-sku="' + esc(item.sku) + '">−</button>';
    html += '<span class="rv-qval">' + item.qty + '</span>';
    html += '<button class="rv-qbtn rv-inc" data-sku="' + esc(item.sku) + '">+</button>';
    html += '<span class="rv-item-price">' + fmt(item.price * item.qty) + '</span>';
    html += '<button class="rv-remove" data-sku="' + esc(item.sku) + '">' + (en ? 'Remove' : 'Quitar') + '</button>';
    html += '</div></div></div>';
  });
  body.innerHTML = html;

  var fh = '<div class="rv-dtotal"><span class="rv-dtotal-label">Total</span><span class="rv-dtotal-val">' + fmt(totalValue()) + '</span></div>';
  fh += '<div class="rv-dactions">';
  fh += '<div class="rv-export-row">';
  fh += '<button class="rv-ebtn" id="rv-xl-btn">' + XLS_SVG + 'Excel</button>';
  fh += '<button class="rv-ebtn" id="rv-pdf-btn">' + PDF_SVG + 'PDF</button>';
  fh += '</div>';
  fh += '<a class="rv-ebtn rv-ebtn-wa" href="' + esc(buildWaLink()) + '" target="_blank" rel="noopener">' + WA_SVG + (en ? 'Send via WhatsApp' : 'Enviar por WhatsApp') + '</a>';
  fh += '</div>';
  foot.innerHTML = fh;
  var xlBtn = document.getElementById('rv-xl-btn');
  var pdBtn = document.getElementById('rv-pdf-btn');
  if (xlBtn) xlBtn.onclick = exportXlsx;
  if (pdBtn) pdBtn.onclick = exportPdf;
}

/* ── Event delegation ── */
document.addEventListener('click', function (e) {
  var addBtn = e.target.closest ? e.target.closest('.rv-cart-btn') : null;
  if (addBtn) {
    var sku = addBtn.dataset.sku, name = addBtn.dataset.name, price = parseFloat(addBtn.dataset.price) || 0, img = addBtn.dataset.img || '';
    if (sku) {
      addItem(sku, name, price, img);
      addBtn.classList.add('rv-added');
      var orig = addBtn.textContent;
      addBtn.textContent = isEN() ? '✓ Added' : '✓ Agregado';
      setTimeout(function () { if (addBtn.textContent !== orig) { addBtn.textContent = orig; } addBtn.classList.remove('rv-added'); }, 1500);
    }
    return;
  }
  var dec = e.target.closest ? e.target.closest('.rv-dec') : null;
  if (dec && dec.dataset.sku) { changeQty(dec.dataset.sku, -1); return; }
  var inc = e.target.closest ? e.target.closest('.rv-inc') : null;
  if (inc && inc.dataset.sku) { changeQty(inc.dataset.sku, 1); return; }
  var rm = e.target.closest ? e.target.closest('.rv-remove') : null;
  if (rm && rm.dataset.sku) { removeItem(rm.dataset.sku); return; }
});

/* ── Cart operations ── */
function addItem(sku, name, price, img) {
  sku = String(sku);
  for (var i = 0; i < state.items.length; i++) {
    if (state.items[i].sku === sku) { state.items[i].qty++; save(); refreshBadge(); return; }
  }
  state.items.push({ sku: sku, name: String(name || ''), price: Number(price) || 0, img: img || '', qty: 1 });
  save(); refreshBadge();
}

function removeItem(sku) {
  state.items = state.items.filter(function (i) { return i.sku !== String(sku); });
  save(); refreshBadge(); renderDrawer();
}

function changeQty(sku, delta) {
  for (var i = 0; i < state.items.length; i++) {
    if (state.items[i].sku === String(sku)) { state.items[i].qty = Math.max(1, state.items[i].qty + delta); break; }
  }
  save(); refreshBadge(); renderDrawer();
}

/* ── Script loader ── */
function loadScript(src, cb) {
  if (document.querySelector('script[src="' + src + '"]')) { if (window.XLSX || window.jspdf) { cb && cb(); return; } }
  var sc = document.createElement('script'); sc.src = src; sc.onload = function () { cb && cb(); }; document.head.appendChild(sc);
}

/* ── Export Excel ── */
function exportXlsx() {
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', function () {
    var XLSX = window.XLSX; if (!XLSX) return;
    var en = isEN();
    var rows = [[en?'SKU':'SKU', en?'Product':'Producto', en?'Unit Price':'Precio Unit.', en?'Qty':'Cantidad', en?'Subtotal':'Subtotal']];
    state.items.forEach(function (item) { rows.push([item.sku, item.name, item.price, item.qty, item.price * item.qty]); });
    rows.push([]); rows.push(['', '', '', en?'TOTAL':'TOTAL', totalValue()]);
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:16},{wch:52},{wch:14},{wch:10},{wch:14}];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, en?'Order':'Pedido');
    XLSX.writeFile(wb, 'Rivero-Pedido.xlsx');
  });
}

/* ── Export PDF ── */
function exportPdf() {
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () {
    var jsPDF = window.jspdf && window.jspdf.jsPDF; if (!jsPDF) return;
    var en = isEN();
    var doc = new jsPDF({ unit: 'pt', format: 'letter' });
    var y = 55, m = 48;
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(35,92,242);
    doc.text('RIVERO SOLUTIONS', m, y); y += 22;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(110);
    doc.text('4071 W 108th Street, Suite 14, Hialeah, FL 33018', m, y); y += 12;
    doc.text('sales@riveroco.com  ·  +1 (555) 801-6189', m, y); y += 26;
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(26);
    doc.text(en ? 'Order Summary' : 'Resumen del Pedido', m, y); y += 8;
    doc.setDrawColor(220,225,235); doc.setLineWidth(1); doc.line(m, y, 612-m, y); y += 16;
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(150);
    doc.text('SKU', m, y);
    doc.text(en?'PRODUCT':'PRODUCTO', m+76, y);
    doc.text(en?'PRICE':'PRECIO', 390, y, {align:'right'});
    doc.text(en?'QTY':'CANT.', 435, y, {align:'right'});
    doc.text('TOTAL', 612-m, y, {align:'right'}); y += 10;
    doc.setDrawColor(235,238,243); doc.line(m, y, 612-m, y); y += 12;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(26);
    state.items.forEach(function (item) {
      if (y > 700) { doc.addPage(); y = 55; }
      doc.text(String(item.sku), m, y);
      doc.text(String(item.name).substring(0, 55), m+76, y);
      doc.text('$'+item.price.toFixed(2), 390, y, {align:'right'});
      doc.text(String(item.qty), 435, y, {align:'right'});
      doc.text('$'+(item.price*item.qty).toFixed(2), 612-m, y, {align:'right'});
      y += 15;
    });
    y += 8;
    doc.setDrawColor(35,92,242); doc.setLineWidth(1.5); doc.line(m, y, 612-m, y); y += 14;
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(35,92,242);
    doc.text('TOTAL', 435, y, {align:'right'});
    doc.text('$'+totalValue().toFixed(2), 612-m, y, {align:'right'});
    doc.save('Rivero-Pedido.pdf');
  });
}

/* ── Wire gabinetes static .pc[data-sku] cards ── */
function wireGabineteCards() {
  var cards = document.querySelectorAll('.pc[data-sku]');
  if (!cards.length) return;
  var en = isEN();
  cards.forEach(function (card) {
    if (card.querySelector('.rv-cart-btn')) return;
    var sku = card.getAttribute('data-sku'); if (!sku) return;
    var nameEl = card.querySelector('.pc-name');
    var priceEl = card.querySelector('.pc-yours-val');
    var imgEl = card.querySelector('.pc-media img');
    if (!nameEl) return;
    var name = nameEl.textContent.trim();
    var price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;
    var img = imgEl ? imgEl.src : '';
    var cta = card.querySelector('.pc-cta'); if (!cta) return;
    var btn = document.createElement('button');
    btn.className = 'rv-cart-btn';
    btn.dataset.sku = sku; btn.dataset.name = name; btn.dataset.price = price; btn.dataset.img = img;
    btn.textContent = en ? 'Add to cart' : 'Agregar al carrito';
    cta.appendChild(btn);
  });
}

/* ── Newsletter injection ── */
function injectNewsletter() {
  var bodyEl = document.getElementById('footer-body');
  if (!bodyEl || document.getElementById('rv-nl-wrap')) return;
  var en = isEN();
  var wrap = document.createElement('div');
  wrap.id = 'rv-nl-wrap';
  wrap.className = 'rv-nl-wrap';
  wrap.innerHTML =
    '<div class="rv-nl-eyebrow">Newsletter</div>' +
    '<p class="rv-nl-desc">' + (en
      ? 'Get inventory updates and exclusive offers.'
      : 'Recibí novedades de inventario y ofertas exclusivas.') + '</p>' +
    '<div class="rv-nl-row">' +
      '<input class="rv-nl-input" id="rv-nl-email" type="email" placeholder="' + (en ? 'your@email.com' : 'tu@email.com') + '" required>' +
      '<button class="rv-nl-btn" id="rv-nl-submit">' + (en ? 'Subscribe →' : 'Suscribirme →') + '</button>' +
    '</div>' +
    '<div class="rv-nl-thanks" id="rv-nl-thanks">' + (en ? '✓ Thanks! We\'ll be in touch.' : '✓ ¡Gracias! Te contactamos pronto.') + '</div>';
  bodyEl.parentNode.insertBefore(wrap, bodyEl.nextSibling);

  document.getElementById('rv-nl-submit').onclick = function () {
    var email = (document.getElementById('rv-nl-email') || {}).value || '';
    if (!email || !email.includes('@')) return;
    var subject = encodeURIComponent(en ? 'Newsletter subscriber' : 'Suscriptor Newsletter Rivero');
    var body = encodeURIComponent((en ? 'New newsletter subscription\n\nEmail: ' : 'Nueva suscripción al newsletter\n\nEmail: ') + email);
    window.open('mailto:sales@riveroco.com?subject=' + subject + '&body=' + body, '_self');
    var thanks = document.getElementById('rv-nl-thanks');
    if (thanks) { thanks.style.display = 'block'; }
    wrap.querySelector('.rv-nl-row').style.display = 'none';
  };
}

/* ── Public API ── */
window.RVCART = { add: addItem, remove: removeItem, changeQty: changeQty, open: openDrawer, close: closeDrawer, toggle: toggleDrawer };

/* ── Inactivity reminder ── */
var REMIND_MS = 30000;
var remindTimer = null;
var remindShown = false;
var remindEl = null;
var remindBdEl = null;

function showRemind() {
  if (remindShown || totalCount() === 0) return;
  remindShown = true;
  var en = isEN();
  var n = totalCount();
  var itemWord = en ? (n === 1 ? 'item' : 'items') : (n === 1 ? 'producto' : 'productos');
  var bd = document.createElement('div');
  bd.className = 'rv-remind-backdrop';
  bd.onclick = closeRemind;
  document.body.appendChild(bd);
  remindBdEl = bd;

  var el = document.createElement('div');
  el.className = 'rv-remind';
  el.innerHTML =
    '<div class="rv-remind-inner">' +
      '<button class="rv-remind-x" aria-label="Cerrar">&#x2715;</button>' +
      '<span class="rv-remind-icon">🛒</span>' +
      '<div class="rv-remind-title">' + (en ? 'Still thinking?' : '¿Seguís ahí?') + '</div>' +
      '<p class="rv-remind-body">' + (en
        ? 'You have <strong>' + n + ' ' + itemWord + '</strong> in your cart. Ready to complete your order?'
        : 'Tenés <strong>' + n + ' ' + itemWord + '</strong> en tu carrito. ¿Completamos el pedido?') + '</p>' +
      '<button class="rv-remind-cta">' + (en ? 'View cart →' : 'Ver carrito →') + '</button>' +
      '<button class="rv-remind-skip">' + (en ? 'Not now' : 'Ahora no') + '</button>' +
    '</div>';
  document.body.appendChild(el);
  remindEl = el;

  el.querySelector('.rv-remind-x').onclick = closeRemind;
  el.querySelector('.rv-remind-skip').onclick = closeRemind;
  el.querySelector('.rv-remind-cta').onclick = function () { closeRemind(); openDrawer(); };

  requestAnimationFrame(function () {
    bd.classList.add('rv-remind--in');
    el.classList.add('rv-remind--in');
  });
}

function closeRemind() {
  if (remindEl) { remindEl.classList.remove('rv-remind--in'); }
  if (remindBdEl) { remindBdEl.classList.remove('rv-remind--in'); }
  setTimeout(function () {
    if (remindEl && remindEl.parentNode) { remindEl.parentNode.removeChild(remindEl); remindEl = null; }
    if (remindBdEl && remindBdEl.parentNode) { remindBdEl.parentNode.removeChild(remindBdEl); remindBdEl = null; }
  }, 380);
}

function resetRemindTimer() {
  if (remindShown) return;
  clearTimeout(remindTimer);
  remindTimer = setTimeout(showRemind, REMIND_MS);
}

['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function (ev) {
  document.addEventListener(ev, resetRemindTimer, { passive: true });
});
resetRemindTimer();

/* ── Init ── */
function initPage() { wireGabineteCards(); injectNewsletter(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
window.addEventListener('rivero:live', initPage);
})();
