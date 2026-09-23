#!/usr/bin/env node
/**
 * Fetches live quantities from the Rivero Cloudflare Worker and patches
 * inventory-data.js in place. Only qty values are updated; all other product
 * data (names, prices, images) stays as-is. Run via GitHub Actions daily.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const WORKER_URL = 'https://rivero-catalog.lucas-af2.workers.dev';
const INVENTORY_PATH = path.resolve(__dirname, '..', 'inventory-data.js');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
  });
}

async function main() {
  console.log('Fetching live inventory from Worker...');
  const data = await fetchJSON(WORKER_URL);

  const items = Array.isArray(data) ? data : (data.items || []);
  if (!items.length) {
    console.log('Worker returned 0 items — skipping update.');
    process.exit(0);
  }

  // Build SKU → availableQty map
  const liveQty = {};
  for (const item of items) {
    const sku = String(item.modelId || '').trim();
    if (sku && typeof item.availableQty === 'number') {
      liveQty[sku] = item.availableQty;
    }
  }
  console.log(`Live data: ${Object.keys(liveQty).length} SKUs`);

  // Patch qty values line by line (each product is one line in inventory-data.js)
  const src = fs.readFileSync(INVENTORY_PATH, 'utf8');
  let updated = 0;

  const patched = src.split('\n').map(line => {
    const skuMatch = line.match(/sku:'([^']+)'/);
    if (!skuMatch) return line;
    const sku = skuMatch[1];
    if (!Object.prototype.hasOwnProperty.call(liveQty, sku)) return line;
    const newLine = line.replace(/(,?\s*qty:)\d+/, `$1${liveQty[sku]}`);
    if (newLine !== line) updated++;
    return newLine;
  }).join('\n');

  if (updated === 0) {
    console.log('No qty changes detected — nothing to commit.');
    process.exit(0);
  }

  fs.writeFileSync(INVENTORY_PATH, patched, 'utf8');
  console.log(`Updated ${updated} product quantities. File written.`);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
