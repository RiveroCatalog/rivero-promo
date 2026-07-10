/**
 * Fetch product images from rivero.website by:
 * 1. Fetching the page HTML and parsing __NEXT_DATA__ or initial data
 * 2. Making direct API calls to the backend
 * No Playwright needed - uses only Node.js built-ins.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RIVERO_URL = 'https://rivero.website/b2b/279ef060-a90a-4139-b0ab-a470f191256d';
const RIVERO_HOST = 'rivero.website';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function request(url, opts = {}, redirects = 0) {
  if (redirects > 8) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': opts.accept || 'text/html,application/xhtml+xml,application/json,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        ...(opts.headers || {})
      },
      method: opts.method || 'GET'
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : `https://${RIVERO_HOST}${res.headers.location}`;
        return request(loc, opts, redirects+1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Parse which SKUs need images
const inv = fs.readFileSync('inventory-data.js', 'utf8');
const allSKUs = new Set([...inv.matchAll(/sku:'([^']+)'/g)].map(m => m[1]));
const existingImgs = new Set(fs.existsSync('products') ? fs.readdirSync('products').map(f => path.parse(f).name) : []);
const needed = [...allSKUs].filter(s => !existingImgs.has(s));
console.log(`Need: ${needed.length} images`);

(async () => {
  // ── Step 1: Fetch the main page HTML ──
  console.log('\nFetching:', RIVERO_URL);
  const pageRes = await request(RIVERO_URL);
  const html = pageRes.body.toString('utf8');
  console.log(`Status: ${pageRes.status}, Size: ${html.length} chars`);

  // Save full HTML for debug
  fs.writeFileSync('debug_full_html.txt', html.substring(0, 200000));

  // ── Step 2: Look for __NEXT_DATA__ (Next.js initial state) ──
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    console.log('\nFound __NEXT_DATA__! Parsing...');
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      fs.writeFileSync('debug_next_data.json', JSON.stringify(nextData, null, 2).substring(0, 500000));
      console.log(`Saved debug_next_data.json`);

      // Extract product data from Next.js page props
      const str = JSON.stringify(nextData);
      const imageUrls = [...str.matchAll(/"(?:imageUrl|image|img|thumbnail|photo)"\s*:\s*"(https?[^"\\]+)"/g)].map(m => m[1]);
      const skus = [...str.matchAll(/"(?:sku|itemId|internetNumber|internet_number)"\s*:\s*"?(\d{5,15})"?/g)].map(m => m[1]);
      console.log(`Found ${imageUrls.length} image URLs and ${skus.length} SKUs in __NEXT_DATA__`);
    } catch(e) {
      console.log('Parse error:', e.message);
    }
  } else {
    console.log('No __NEXT_DATA__ found');
  }

  // ── Step 3: Look for JS bundle URLs to find API endpoints ──
  const scriptUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  console.log(`\nJS files: ${scriptUrls.length}`);
  scriptUrls.slice(0,10).forEach(u => console.log(`  ${u.substring(0,80)}`));

  // ── Step 4: Look for embedded JSON data or API configs ──
  const jsonBlocks = [...html.matchAll(/<script[^>]*>([\s\S]{50,}?)<\/script>/g)];
  for (const [, sc] of jsonBlocks) {
    if (sc.includes('api') || sc.includes('endpoint') || sc.includes('baseUrl') || sc.includes('fetch')) {
      console.log('\nInteresting script block:');
      console.log(sc.substring(0, 500));
    }
  }

  // ── Step 5: Try common API endpoints for rivero.website ──
  const guessedApis = [
    `https://${RIVERO_HOST}/api/b2b/279ef060-a90a-4139-b0ab-a470f191256d`,
    `https://${RIVERO_HOST}/api/b2b/products?id=279ef060-a90a-4139-b0ab-a470f191256d`,
    `https://${RIVERO_HOST}/api/catalog/279ef060-a90a-4139-b0ab-a470f191256d`,
    `https://${RIVERO_HOST}/api/products`,
    `https://${RIVERO_HOST}/b2b/api/279ef060-a90a-4139-b0ab-a470f191256d`,
  ];

  for (const apiUrl of guessedApis) {
    try {
      const r = await request(apiUrl, { accept: 'application/json', headers: { 'Accept': 'application/json' } });
      console.log(`${apiUrl.split('/').slice(-2).join('/')}: HTTP ${r.status} (${r.body.length} bytes)`);
      if (r.status === 200 && r.body.length > 100) {
        const text = r.body.toString('utf8');
        if (text.startsWith('[') || text.startsWith('{')) {
          console.log(`  JSON response preview: ${text.substring(0,200)}`);
          fs.writeFileSync('debug_api_found.json', text.substring(0, 500000));
        }
      }
    } catch(e) {
      console.log(`  ${apiUrl}: ${e.message}`);
    }
    await sleep(300);
  }

  // ── Commit debug files ──
  execSync('git config user.name "github-actions[bot]"');
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  execSync('git add debug_full_html.txt debug_next_data.json debug_api_found.json 2>/dev/null || git add debug_full_html.txt', { shell: true });
  const st = execSync('git status --porcelain').toString().trim();
  if (st) {
    execSync('git commit -m "DEBUG: rivero.website API discovery"');
    execSync('git push');
    console.log('\n✓ Debug files committed!');
  } else {
    console.log('\nNo new files to commit.');
  }
})();
