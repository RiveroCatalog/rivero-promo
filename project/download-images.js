/**
 * Download product images from Home Depot CDN.
 * Uses only Node.js built-in modules (no extra dependencies).
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse inventory-data.js to find which SKUs need images
const inventoryContent = fs.readFileSync('inventory-data.js', 'utf8');
const skuMatches = [...inventoryContent.matchAll(/sku:'([^']+)'[^}]+?img:'products\/([^.]+)\.png'/g)];
const allSKUs = skuMatches.map(m => m[1]);

// Check which images already exist
const existingImages = new Set(
  fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []
);
const missingSKUs = allSKUs.filter(sku => !existingImages.has(sku));

console.log(`Total in inventory: ${allSKUs.length}`);
console.log(`Already have images: ${existingImages.size}`);
console.log(`Need to download: ${missingSKUs.length}`);

if (!missingSKUs.length) {
  console.log('All images already present!');
  process.exit(0);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function get(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.homedepot.com/',
        'Cache-Control': 'no-cache'
      }
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function getHtml(url, redirects = 0) {
  if (redirects > 5) return null;
  try {
    const mod = url.startsWith('https') ? https : http;
    return await new Promise((resolve, reject) => {
      const req = mod.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }, res => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          return getHtml(res.headers.location, redirects + 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return resolve(null);
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  } catch(e) { return null; }
}

function extractImageFromHtml(html) {
  if (!html) return null;
  // Try og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) return ogMatch[1];
  // Try JSON-LD
  const jsonLd = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
  if (jsonLd) return jsonLd[1];
  // Try thdstatic pattern in script tags
  const thdMatch = html.match(/(https:\/\/images\.thdstatic\.com\/productImages\/[^"'\s,)]+)/);
  if (thdMatch) return thdMatch[1];
  return null;
}

async function findImage(sku) {
  // Strategy 1: Direct CDN patterns
  const cdnPatterns = [
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_600.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_1000.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_300.jpg`,
    `https://images.thdstatic.com/productImages/${sku}/svn/${sku}_400.jpg`,
  ];

  for (const url of cdnPatterns) {
    try {
      const res = await get(url);
      if (res.status === 200 && res.data.length > 2000) {
        const ct = res.headers['content-type'] || '';
        if (ct.includes('image') || res.data[0] === 0xFF || res.data[0] === 0x89) {
          return { url, buffer: res.data };
        }
      }
    } catch(e) {}
    await sleep(100);
  }

  // Strategy 2: Scrape product page
  const html = await getHtml(`https://www.homedepot.com/p/${sku}`);
  const imgUrl = extractImageFromHtml(html);
  if (imgUrl) {
    try {
      const res = await get(imgUrl);
      if (res.status === 200 && res.data.length > 2000) {
        return { url: imgUrl, buffer: res.data };
      }
    } catch(e) {}
  }

  return null;
}

(async () => {
  let found = 0;
  const stillMissing = [];

  for (let i = 0; i < missingSKUs.length; i++) {
    const sku = missingSKUs[i];
    process.stdout.write(`[${i+1}/${missingSKUs.length}] ${sku}: `);

    try {
      const result = await findImage(sku);
      if (result) {
        fs.writeFileSync(path.join('products', `${sku}.png`), result.buffer);
        console.log(`✓ ${result.buffer.length} bytes`);
        found++;
      } else {
        console.log('not found');
        stillMissing.push(sku);
      }
    } catch(e) {
      console.log(`error: ${e.message}`);
      stillMissing.push(sku);
    }

    await sleep(500);
  }

  console.log(`\nResults: ${found} downloaded, ${stillMissing.length} not found`);

  if (stillMissing.length) {
    fs.writeFileSync('still_missing_skus.txt', stillMissing.join('\n'));
    console.log(`Still missing (${stillMissing.length}): still_missing_skus.txt`);
  }

  // Git commit
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add products/ still_missing_skus.txt 2>/dev/null || git add products/', { shell: true });
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync(`git commit -m "Add ${found} product images from Home Depot"`);
      execSync('git push');
      console.log(`\n✓ Committed and pushed ${found} images!`);
    } else {
      console.log('\nNo new images to commit.');
    }
  } catch(e) {
    console.error(`Git error: ${e.message}`);
    process.exit(1);
  }
})();
