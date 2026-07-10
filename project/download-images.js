/**
 * Scrape product images from rivero.website B2B catalog
 * and commit them to the GitHub repo products/ folder.
 */
const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Parse inventory to know which SKUs we need
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
    viewport: { width: 1280, height: 900 }
  });

  const page = await context.newPage();

  // ── Step 1: Load the rivero.website catalog ──
  console.log(`\nLoading: ${RIVERO_URL}`);
  try {
    await page.goto(RIVERO_URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch(e) {
    console.log(`Warning: ${e.message} — continuing anyway`);
  }

  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Screenshot for debug
  await page.screenshot({ path: '/tmp/rivero_page.png' });

  // ── Step 2: Scroll to load all products (infinite scroll / lazy load) ──
  console.log('Scrolling to load all products...');
  let lastHeight = 0;
  for (let i = 0; i < 30; i++) {
    const h = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });
    if (h === lastHeight) break;
    lastHeight = h;
    await sleep(1500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1000);

  // ── Step 3: Extract SKU → image URL mappings ──
  console.log('Extracting product images...');

  // Try to find SKUs and images via common patterns
  const products = await page.evaluate(() => {
    const results = [];

    // Pattern 1: elements with data-sku or data-item-id attributes
    document.querySelectorAll('[data-sku],[data-item-id],[data-product-id],[data-id]').forEach(el => {
      const sku = el.dataset.sku || el.dataset.itemId || el.dataset.productId || el.dataset.id;
      const img = el.querySelector('img');
      if (sku && img) results.push({ sku: sku.trim(), img: img.src || img.dataset.src });
    });

    // Pattern 2: look for SKU in text near an image
    if (results.length === 0) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || '';
        if (!src || src.includes('logo') || src.includes('icon') || src.length < 20) return;
        
        // Check parent elements for SKU-like text
        let el = img.parentElement;
        for (let depth = 0; depth < 6; depth++) {
          if (!el) break;
          const text = el.textContent || '';
          // Look for numeric SKU patterns (6-13 digits)
          const skuMatch = text.match(/\b(\d{6,13})\b/);
          if (skuMatch) {
            results.push({ sku: skuMatch[1], img: src });
            break;
          }
          el = el.parentElement;
        }
      });
    }

    // Pattern 3: Extract from script/JSON data embedded in page
    const scripts = [...document.querySelectorAll('script:not([src])')];
    for (const sc of scripts) {
      const t = sc.textContent;
      // Look for JSON with sku/image pairs
      const matches = [...t.matchAll(/"(?:sku|itemId|productId|internet_number)"\s*:\s*"?(\d{5,13})"?[^}]{0,500}"(?:image|img|imageUrl|picture)"\s*:\s*"(https?[^"]+)"/g)];
      for (const m of matches) results.push({ sku: m[1], img: m[2] });
      
      const matches2 = [...t.matchAll(/"(?:image|img|imageUrl)"\s*:\s*"(https?[^"]+)"[^}]{0,500}"(?:sku|itemId|productId)"\s*:\s*"?(\d{5,13})"?/g)];
      for (const m of matches2) results.push({ sku: m[2], img: m[1] });
    }

    return results;
  });

  console.log(`Found ${products.length} product/image pairs on page`);

  // Deduplicate
  const skuToImg = {};
  for (const { sku, img } of products) {
    if (sku && img && img.startsWith('http') && !img.includes('placeholder')) {
      skuToImg[sku] = img;
    }
  }

  console.log(`Unique SKU→image mappings: ${Object.keys(skuToImg).length}`);

  // ── Step 4: If we found SKU→image mappings, download them ──
  let found = 0;
  const stillMissing = [];

  if (Object.keys(skuToImg).length > 0) {
    // Save the mapping for reference
    fs.writeFileSync('/tmp/sku_img_map.json', JSON.stringify(skuToImg, null, 2));

    for (const sku of needed) {
      const imgUrl = skuToImg[sku];
      if (!imgUrl) { stillMissing.push(sku); continue; }

      process.stdout.write(`${sku}: `);
      try {
        const buf = await download(imgUrl);
        if (buf.length < 500) throw new Error('Image too small');
        fs.writeFileSync(path.join('products', `${sku}.png`), buf);
        console.log(`✓ ${buf.length} bytes`);
        found++;
      } catch(e) {
        console.log(`error: ${e.message}`);
        stillMissing.push(sku);
      }
      await sleep(300);
    }
  } else {
    // ── Step 5: Try loading individual product pages ──
    console.log('\nNo mappings found on main page. Trying to find product detail links...');
    
    const links = await page.evaluate(() => {
      return [...document.querySelectorAll('a[href]')]
        .map(a => a.href)
        .filter(h => h.includes('product') || h.includes('item') || h.includes('p/'))
        .slice(0, 20);
    });
    
    console.log(`Product links found: ${links.length}`);
    for (const link of links.slice(0, 3)) {
      console.log(`  ${link}`);
    }
    
    // Save page HTML for debugging
    const html = await page.content();
    fs.writeFileSync('/tmp/rivero_page.html', html.substring(0, 50000));
    console.log('Saved first 50KB of page HTML to /tmp/rivero_page.html');
    
    stillMissing.push(...needed);
  }

  await browser.close();

  // ── Step 6: Commit results ──
  if (stillMissing.length) {
    fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));
  }

  console.log(`\nResults: ${found} images downloaded, ${stillMissing.length} still missing`);

  if (found > 0) {
    try {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync('git add products/ still_missing_skus.txt 2>/dev/null || git add products/', { shell: true });
      const status = execSync('git status --porcelain').toString().trim();
      if (status) {
        execSync(`git commit -m "Add ${found} product images from rivero.website"`);
        execSync('git push');
        console.log(`✓ Pushed ${found} images to repo!`);
      }
    } catch(e) {
      console.error(`Git error: ${e.message}`);
      process.exit(1);
    }
  }
})();
