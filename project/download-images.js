/**
 * Download product images.
 * Priority: 1) Google Sheet image URLs, 2) Home Depot CDN, 3) HD product page scrape
 * Uses only Node.js built-in modules.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SHEET_ID = '1bGwr8R0q-91uqpfPEbEU40SDmhIbSeHD';
const SHEET_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function get(url, opts = {}, redirects = 0) {
  if (redirects > 8) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': opts.accept || '*/*',
      ...(opts.headers || {})
    };
    const req = mod.get(url, { timeout: 25000, headers }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, opts, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Parse CSV with semicolon delimiter
function parseCSV(text) {
  const lines = text.split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple split on semicolons (handles quoted fields)
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ';' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }
  return rows;
}

async function loadSheetImageUrls() {
  console.log('Fetching Google Sheet for image URLs...');
  try {
    const res = await get(SHEET_EXPORT_URL, {
      accept: 'text/csv,text/plain,*/*',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.status !== 200) {
      console.log(`Sheet fetch failed: HTTP ${res.status} (sheet may not be public)`);
      return {};
    }
    const text = res.data.toString('utf8');
    const rows = parseCSV(text);
    if (rows.length < 2) { console.log('Sheet empty'); return {}; }

    // Find header row
    const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const skuIdx = header.findIndex(h => h.includes('sku'));
    const imgIdx = header.findIndex(h => h.includes('image') || h.includes('img'));

    if (skuIdx === -1 || imgIdx === -1) {
      // Try row 1 as second possible header
      const h2 = rows[1].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
      const si2 = h2.findIndex(h => h.includes('sku'));
      const ii2 = h2.findIndex(h => h.includes('image') || h.includes('img'));
      if (si2 === -1 || ii2 === -1) {
        console.log(`Column not found. Headers: ${rows[0].join(' | ')}`);
        return {};
      }
      console.log(`Using row 1 as header. SKU col: ${si2}, Image col: ${ii2}`);
      const map = {};
      for (const row of rows.slice(2)) {
        const sku = (row[si2] || '').trim();
        const img = (row[ii2] || '').trim();
        if (sku && img && img.startsWith('http')) map[sku] = img;
      }
      console.log(`Sheet image URLs found: ${Object.keys(map).length}`);
      return map;
    }

    const map = {};
    for (const row of rows.slice(1)) {
      const sku = (row[skuIdx] || '').trim();
      const img = (row[imgIdx] || '').trim();
      if (sku && img && img.startsWith('http')) map[sku] = img;
    }
    console.log(`Sheet image URLs found: ${Object.keys(map).length}`);
    return map;
  } catch(e) {
    console.log(`Sheet fetch error: ${e.message} (will use HD CDN instead)`);
    return {};
  }
}

async function tryHdCdn(sku) {
  const patterns = [
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_600.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_1000.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_300.jpg`,
  ];
  for (const url of patterns) {
    try {
      const res = await get(url, { headers: { 'Referer': 'https://www.homedepot.com/' } });
      if (res.status === 200 && res.data.length > 2000) {
        const ct = res.headers['content-type'] || '';
        if (ct.includes('image') || res.data[0] === 0xFF || res.data[0] === 0x89 || res.data[0] === 0x47) {
          return { url, buf: res.data };
        }
      }
    } catch(e) {}
    await sleep(150);
  }
  return null;
}

async function tryHdPage(sku) {
  try {
    const res = await get(`https://www.homedepot.com/p/${sku}`, {
      accept: 'text/html,application/xhtml+xml'
    });
    if (res.status !== 200) return null;
    const html = res.data.toString('utf8');
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (og) return og[1];
    const thd = html.match(/(https:\/\/images\.thdstatic\.com\/productImages\/[^"'\s,)]+\.(?:jpg|jpeg|png|webp))/i);
    if (thd) return thd[1];
  } catch(e) {}
  return null;
}

// Main
(async () => {
  // Parse inventory to find which SKUs need images
  const inv = fs.readFileSync('inventory-data.js', 'utf8');
  const allSKUs = [...inv.matchAll(/sku:'([^']+)'[^}]+?img:'products\//g)].map(m => m[1]);
  const existingImgs = new Set(
    fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []
  );
  const missingSKUs = allSKUs.filter(sku => !existingImgs.has(sku));

  console.log(`Inventory: ${allSKUs.length} | Existing: ${existingImgs.size} | Missing: ${missingSKUs.length}`);
  if (!missingSKUs.length) { console.log('All images present!'); process.exit(0); }

  // Load image URLs from Google Sheet (if public)
  const sheetUrls = await loadSheetImageUrls();

  let found = 0;
  const stillMissing = [];

  for (let i = 0; i < missingSKUs.length; i++) {
    const sku = missingSKUs[i];
    process.stdout.write(`[${i+1}/${missingSKUs.length}] ${sku}: `);

    let buf = null;
    let src = '';

    // 1. Try Google Sheet URL
    if (sheetUrls[sku]) {
      try {
        const res = await get(sheetUrls[sku]);
        if (res.status === 200 && res.data.length > 500) {
          buf = res.data;
          src = 'sheet';
        }
      } catch(e) {}
    }

    // 2. Try HD CDN
    if (!buf) {
      const cdn = await tryHdCdn(sku);
      if (cdn) { buf = cdn.buf; src = 'cdn'; }
    }

    // 3. Try HD product page
    if (!buf) {
      const pageUrl = await tryHdPage(sku);
      if (pageUrl) {
        try {
          const res = await get(pageUrl, { headers: { 'Referer': 'https://www.homedepot.com/' } });
          if (res.status === 200 && res.data.length > 500) { buf = res.data; src = 'page'; }
        } catch(e) {}
      }
    }

    if (buf) {
      fs.writeFileSync(path.join('products', `${sku}.png`), buf);
      console.log(`✓ ${src} (${buf.length} bytes)`);
      found++;
    } else {
      console.log('not found');
      stillMissing.push(sku);
    }

    await sleep(400);
  }

  console.log(`\nResults: ${found} downloaded, ${stillMissing.length} not found`);
  if (stillMissing.length) fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));

  // Commit
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add products/');
    if (stillMissing.length) execSync('git add still_missing_skus.txt');
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync(`git commit -m "Add ${found} product images (sheet+HD CDN)"`);
      execSync('git push');
      console.log(`✓ Pushed ${found} images!`);
    } else {
      console.log('Nothing new to commit.');
    }
  } catch(e) { console.error(`Git error: ${e.message}`); process.exit(1); }
})();
