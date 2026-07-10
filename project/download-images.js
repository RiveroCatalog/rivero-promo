const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

try { require.resolve('playwright'); } catch(e) {
  execSync('npm install playwright', { stdio: 'inherit' });
  execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
}
const { chromium } = require('playwright');

const RIVERO_URL = 'https://rivero.website/b2b/279ef060-a90a-4139-b0ab-a470f191256d';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function dlImg(url, redirects = 0) {
  if (redirects > 8) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' } }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return dlImg(res.headers.location, redirects+1).then(resolve).catch(reject);
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject).on('timeout', function(){ this.destroy(); reject(new Error('timeout')); });
  });
}

// Read which SKUs we need
const inv = fs.readFileSync('inventory-data.js', 'utf8');
const allSKUs = new Set([...inv.matchAll(/sku:'([^']+)'/g)].map(m => m[1]));
const existingImgs = new Set(fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []);
const needed = [...allSKUs].filter(s => !existingImgs.has(s));
console.log(`Need: ${needed.length} images`);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Capture all API responses
  const apiResponses = [];
  const capturedImgBufs = new Map(); // imgUrl → buffer

  page.on('response', async resp => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    try {
      if (ct.includes('json') && resp.status() === 200) {
        const body = await resp.text();
        if (body.length > 100) {
          apiResponses.push({ url, body: body.substring(0, 50000) });
          console.log(`API: ${url.substring(0,80)} (${body.length} chars)`);
        }
      }
      if (ct.startsWith('image/') && resp.status() === 200) {
        const buf = await resp.body();
        if (buf.length > 500) capturedImgBufs.set(url, buf);
      }
    } catch(e) {}
  });

  console.log('Loading:', RIVERO_URL);
  try { await page.goto(RIVERO_URL, { waitUntil: 'networkidle', timeout: 60000 }); }
  catch(e) { console.log('Load warning:', e.message); }

  // Scroll to trigger lazy loading
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await sleep(1500);
  }
  await sleep(3000);

  console.log(`\nAPI calls captured: ${apiResponses.length}`);
  console.log(`Images captured: ${capturedImgBufs.size}`);

  // Save API responses for debug
  fs.writeFileSync('debug_api_responses.json', JSON.stringify(apiResponses.map(r => ({
    url: r.url,
    preview: r.body.substring(0, 500)
  })), null, 2));

  // Try to extract SKU→image from API responses
  const skuToImg = {};
  for (const { url, body } of apiResponses) {
    try {
      // Try JSON parse
      let data;
      try { data = JSON.parse(body); } catch(e) { continue; }
      const str = JSON.stringify(data);
      
      // Look for image URLs associated with SKUs
      const patterns = [
        /["'](?:sku|itemId|internetNumber|internet_number)["']\s*:\s*["']?(\d{5,15})["']?/g,
        /["'](?:imageUrl|image|img|thumbnail|picture|photo)["']\s*:\s*["'](https?[^"'\\]+)/g
      ];
      
      const skus = [...str.matchAll(patterns[0])].map(m => m[1]);
      const imgs = [...str.matchAll(patterns[1])].map(m => m[1]);
      console.log(`  ${url.substring(0,60)}: ${skus.length} SKUs, ${imgs.length} images`);
      
      // Try to pair them up from array items
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (!item || typeof item !== 'object') return;
          const sku = item.sku || item.itemId || item.internetNumber || item.internet_number || item.SKU;
          const img = item.imageUrl || item.image || item.img || item.thumbnail || item.picture || item.photo || item.Image;
          if (sku && img && typeof img === 'string' && img.startsWith('http')) {
            skuToImg[String(sku)] = img;
          }
        });
      }
      // Also try nested structures
      const findSkuImg = (obj, depth = 0) => {
        if (depth > 5 || !obj || typeof obj !== 'object') return;
        const sku = obj.sku || obj.itemId || obj.internetNumber;
        const img = obj.imageUrl || obj.image || obj.img || obj.thumbnail;
        if (sku && img && typeof img === 'string' && img.startsWith('http')) {
          skuToImg[String(sku)] = img;
        }
        Object.values(obj).forEach(v => { if (Array.isArray(v)) v.forEach(i => findSkuImg(i, depth+1)); });
      };
      findSkuImg(data);
    } catch(e) {}
  }

  // Match captured images to SKUs by URL content
  for (const [imgUrl] of capturedImgBufs) {
    for (const sku of needed) {
      if (imgUrl.includes(sku) && !skuToImg[sku]) skuToImg[sku] = imgUrl;
    }
  }

  console.log(`\nSKU→image mappings found: ${Object.keys(skuToImg).length}`);

  // Full page text for debug
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0,5000) || '');
  console.log(`\nPage text preview:\n${bodyText.substring(0,1000)}`);
  
  // Screenshot
  await page.screenshot({ path: 'debug_rivero.png', fullPage: false });

  await browser.close();

  // Save debug info
  fs.writeFileSync('debug_sku_map.json', JSON.stringify(skuToImg, null, 2));
  console.log(`\nSaved debug_sku_map.json with ${Object.keys(skuToImg).length} entries`);

  // Download and save images we found
  let found = 0;
  const stillMissing = [];

  for (const sku of needed) {
    const imgUrl = skuToImg[sku];
    let buf = imgUrl ? capturedImgBufs.get(imgUrl) : null;

    if (!buf && imgUrl) {
      try {
        const r = await dlImg(imgUrl);
        if (r.status === 200 && r.buf.length > 500) buf = r.buf;
      } catch(e) {}
    }
    if (!buf) {
      for (const [u, b] of capturedImgBufs) {
        if (u.includes(sku)) { buf = b; break; }
      }
    }

    if (buf && buf.length > 500) {
      fs.writeFileSync(path.join('products', `${sku}.png`), buf);
      found++;
      if (found <= 10) process.stdout.write(`✓${sku} `);
    } else {
      stillMissing.push(sku);
    }
  }

  console.log(`\n\nImages: ${found} downloaded, ${stillMissing.length} still missing`);
  if (stillMissing.length) fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));

  // Commit everything
  execSync('git config user.name "github-actions[bot]"');
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  execSync('git add debug_rivero.png debug_api_responses.json debug_sku_map.json still_missing_skus.txt products/ 2>/dev/null || true', { shell: true });
  const st = execSync('git status --porcelain').toString().trim();
  if (st) {
    execSync(`git commit -m "DEBUG rivero: ${found} images + API data"`);
    execSync('git push');
    console.log('✓ Committed!');
  }
})();
