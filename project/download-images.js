/**
 * Downloads product images from Home Depot.
 * Called by the GitHub Actions workflow.
 * Saves images to products/ and commits via git.
 */
const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse inventory-data.js to find which products need images
const inventoryContent = fs.readFileSync('inventory-data.js', 'utf8');
const skuImgPairs = [...inventoryContent.matchAll(/sku:'([^']+)'[^}]+?img:'products\/([^']+)'/g)];

// Check which images already exist
const existingImages = new Set(
  fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []
);

const missingSKUs = skuImgPairs.map(m => m[1]).filter(sku => !existingImages.has(sku));

console.log(`Total in inventory: ${skuImgPairs.length}`);
console.log(`Already have images: ${existingImages.size}`);
console.log(`Need to download: ${missingSKUs.length}`);

if (!missingSKUs.length) {
  console.log('Nothing to do!');
  process.exit(0);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadBuffer(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.homedepot.com/'
      }
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return downloadBuffer(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function tryDirectCDN(sku) {
  const patterns = [
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_600.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_1000.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_300.jpg`,
  ];
  for (const url of patterns) {
    try {
      const buf = await downloadBuffer(url);
      if (buf.length > 2000) return { url, buf };
    } catch(e) {}
  }
  return null;
}

async function getImageViaPlaywright(page, sku) {
  try {
    const resp = await page.goto(`https://www.homedepot.com/p/${sku}`, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });
    if (!resp || resp.status() !== 200) return null;

    // og:image is the most reliable
    const ogImg = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null);
    if (ogImg && ogImg.startsWith('http')) return ogImg;

    // Fallback selectors
    const selectors = [
      '[data-testid="main-image"] img',
      '.mediagallery__mainimage img',
      '.product-image-container img',
      'picture source[type="image/jpeg"]',
    ];
    for (const sel of selectors) {
      const src = await page.$eval(sel, el => el.src || el.srcset).catch(() => null);
      if (src && src.startsWith('http')) return src.split(' ')[0];
    }
    return null;
  } catch(e) {
    return null;
  }
}

(async () => {
  // First try direct CDN (faster, no browser needed)
  console.log('\n--- Phase 1: Direct CDN ---');
  const needBrowser = [];
  let cdnFound = 0;

  for (let i = 0; i < missingSKUs.length; i++) {
    const sku = missingSKUs[i];
    const result = await tryDirectCDN(sku);
    if (result) {
      fs.writeFileSync(path.join('products', `${sku}.png`), result.buf);
      console.log(`[${i+1}/${missingSKUs.length}] ${sku}: ✓ CDN (${result.buf.length} bytes)`);
      cdnFound++;
    } else {
      needBrowser.push(sku);
    }
    await sleep(200);
  }

  console.log(`\nCDN: ${cdnFound} found, ${needBrowser.length} need browser`);

  // Phase 2: Use Playwright for the rest
  if (needBrowser.length > 0) {
    console.log('\n--- Phase 2: Playwright ---');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    let browserFound = 0;
    const stillMissing = [];

    for (let i = 0; i < needBrowser.length; i++) {
      const sku = needBrowser[i];
      process.stdout.write(`[${i+1}/${needBrowser.length}] ${sku}: `);

      const imgUrl = await getImageViaPlaywright(page, sku);
      if (!imgUrl) {
        console.log('no URL found');
        stillMissing.push(sku);
        continue;
      }

      try {
        const buf = await downloadBuffer(imgUrl);
        if (buf.length < 500) throw new Error('Too small');
        fs.writeFileSync(path.join('products', `${sku}.png`), buf);
        console.log(`✓ ${buf.length} bytes`);
        browserFound++;
      } catch(e) {
        console.log(`error: ${e.message}`);
        stillMissing.push(sku);
      }

      await sleep(1000);
    }

    await browser.close();

    console.log(`\nBrowser: ${browserFound} found, ${stillMissing.length} failed`);
    if (stillMissing.length) {
      fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));
      console.log(`Still missing: still_missing_skus.txt`);
    }
  }

  // Commit all new images
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add products/');
    execSync('git add still_missing_skus.txt 2>/dev/null || true', { shell: true });
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync('git commit -m "Add product images from Home Depot"');
      execSync('git push');
      console.log('\n✓ Images committed and pushed!');
    } else {
      console.log('\nNo new images to commit.');
    }
  } catch(e) {
    console.log(`Git error: ${e.message}`);
  }

  console.log('\nDone!');
})();
