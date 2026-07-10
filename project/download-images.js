/**
 * Scrape product images from rivero.website B2B catalog.
 * Self-installs Playwright if not present.
 */
const { execSync, spawnSync } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Self-install playwright if needed
try {
  require.resolve('playwright');
  console.log('Playwright already installed');
} catch(e) {
  console.log('Installing Playwright + Chromium...');
  execSync('npm install playwright', { stdio: 'inherit' });
  execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
  console.log('Playwright installed!');
}

const { chromium } = require('playwright');

const RIVERO_URL = 'https://rivero.website/b2b/279ef060-a90a-4139-b0ab-a470f191256d';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function download(url, redirects = 0) {
  if (redirects > 8) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      }
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return download(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject)
      .on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

// Parse which SKUs need images
const inv = fs.readFileSync('inventory-data.js', 'utf8');
const allSKUs = new Set([...inv.matchAll(/sku:'([^']+)'/g)].map(m => m[1]));
const existingImgs = new Set(
  fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []
);
const needed = [...allSKUs].filter(s => !existingImgs.has(s));
console.log(`Need images for: ${needed.length} SKUs`);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Intercept image requests to capture URLs
  const capturedImages = new Map(); // url → buffer
  page.on('response', async resp => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (ct.startsWith('image/') && resp.status() === 200) {
      try {
        const buf = await resp.body();
        if (buf.length > 1000) capturedImages.set(url, buf);
      } catch(e) {}
    }
  });

  console.log(`\nLoading: ${RIVERO_URL}`);
  try {
    await page.goto(RIVERO_URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch(e) {
    console.log(`Page load warning: ${e.message}`);
  }

  const title = await page.title();
  const html = await page.content();
  console.log(`Title: "${title}" | Page size: ${html.length} chars | Images captured: ${capturedImages.size}`);

  // Save HTML snippet for debug
  fs.writeFileSync('/tmp/rivero_debug.html', html.substring(0, 80000));

  // Scroll to trigger lazy loading
  console.log('Scrolling for lazy-loaded images...');
  for (let i = 0; i < 20; i++) {
    const scrolled = await page.evaluate((step) => {
      window.scrollBy(0, window.innerHeight);
      return window.scrollY;
    }, i);
    await sleep(1200);
    if (i % 5 === 0) console.log(`  Scroll ${i}: ${capturedImages.size} images captured`);
  }
  await sleep(2000);

  console.log(`\nTotal images captured via network: ${capturedImages.size}`);

  // Also extract SKU→image from DOM
  const domProducts = await page.evaluate(() => {
    const results = [];
    // Look for elements with SKU data attributes
    '[data-sku],[data-item-id],[data-product-id],[data-internet-number]'.split(',').forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const sku = el.dataset.sku || el.dataset.itemId || el.dataset.productId || el.dataset.internetNumber;
        const img = el.querySelector('img');
        if (sku && img) results.push({ sku: sku.trim(), img: img.src || img.dataset.src || '' });
      });
    });

    // Look in JSON-LD and embedded data
    document.querySelectorAll('script').forEach(sc => {
      const t = sc.textContent || '';
      // Various SKU+image patterns
      const pats = [
        /["'](?:sku|itemId|internet_number)["']\s*:\s*["']?(\d{5,15})["']?[^}]{1,400}?["'](?:image|img|imageUrl|thumbnail)["']\s*:\s*["'](https?[^"']+)/g,
        /["'](?:image|imageUrl)["']\s*:\s*["'](https?[^"']+)["'][^}]{1,400}?["'](?:sku|itemId)["']\s*:\s*["']?(\d{5,15})/g,
      ];
      for (const pat of pats) {
        [...t.matchAll(pat)].forEach(m => {
          results.push({ sku: m[1].length > 5 ? m[1] : m[2], img: m[1].startsWith('http') ? m[1] : m[2] });
        });
      }
    });

    return results;
  });

  console.log(`DOM extracted: ${domProducts.length} SKU/image pairs`);

  // Build SKU → image URL map from DOM
  const skuToUrl = {};
  for (const { sku, img } of domProducts) {
    if (sku && img && img.startsWith('http')) skuToUrl[sku] = img;
  }

  // Also try matching captured network images to SKUs by URL content
  for (const [url] of capturedImages) {
    for (const sku of needed) {
      if (url.includes(sku) && !skuToUrl[sku]) {
        skuToUrl[sku] = url;
      }
    }
  }

  console.log(`Total SKU→URL mappings: ${Object.keys(skuToUrl).length}`);

  if (Object.keys(skuToUrl).length === 0 && capturedImages.size === 0) {
    // Save more debug info
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
    console.log(`\nPage text preview:\n${bodyText}`);
    
    const allImgSrcs = await page.$$eval('img', els => els.map(el => el.src).filter(Boolean).slice(0, 20));
    console.log(`\nAll img srcs on page:`);
    allImgSrcs.forEach(src => console.log(`  ${src}`));
    
    console.log('\nPage is likely behind auth or empty. Cannot scrape images.');
    await browser.close();
    process.exit(0);
  }

  // Download and save images
  let found = 0;
  const stillMissing = [];

  for (const sku of needed) {
    process.stdout.write(`${sku}: `);

    // Try SKU→URL mapping first
    const imgUrl = skuToUrl[sku];
    let buf = imgUrl ? capturedImages.get(imgUrl) : null;

    // If we have the buffer from network intercept, use it directly
    if (!buf && imgUrl) {
      try {
        buf = await download(imgUrl);
      } catch(e) {}
    }

    // Try to find in captured images by SKU in URL
    if (!buf) {
      for (const [url, imgBuf] of capturedImages) {
        if (url.includes(sku)) { buf = imgBuf; break; }
      }
    }

    if (buf && buf.length > 500) {
      fs.writeFileSync(path.join('products', `${sku}.png`), buf);
      console.log(`✓ ${buf.length} bytes`);
      found++;
    } else {
      console.log('not found');
      stillMissing.push(sku);
    }
  }

  await browser.close();

  // Save still missing list
  if (stillMissing.length) fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));

  console.log(`\n=== Results: ${found} downloaded, ${stillMissing.length} not found ===`);

  // Commit
  if (found > 0) {
    try {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync('git add products/ still_missing_skus.txt 2>/dev/null || git add products/', { shell: true });
      const st = execSync('git status --porcelain').toString().trim();
      if (st) {
        execSync(`git commit -m "Add ${found} product images from rivero.website"`);
        execSync('git push');
        console.log(`✓ Pushed ${found} images!`);
      } else {
        console.log('Nothing to commit.');
      }
    } catch(e) { console.error(`Git: ${e.message}`); process.exit(1); }
  }
})();
