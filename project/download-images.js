const { execSync } = require('child_process');
const fs = require('fs');

// Self-install playwright
try { require.resolve('playwright'); } catch(e) {
  console.log('Installing Playwright...');
  execSync('npm install playwright', { stdio: 'inherit' });
  execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
}

const { chromium } = require('playwright');

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

  const URL = 'https://rivero.website/b2b/279ef060-a90a-4139-b0ab-a470f191256d';
  console.log('Opening:', URL);

  let status = 0;
  try {
    const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
    status = resp ? resp.status() : 0;
  } catch(e) {
    console.log('Load error:', e.message);
  }

  console.log('HTTP status:', status);
  console.log('Title:', await page.title());

  // Wait extra for JS rendering
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot
  await page.screenshot({ path: 'debug_rivero.png', fullPage: false });

  // HTML
  const html = await page.content();
  fs.writeFileSync('debug_rivero.html', html.substring(0, 100000));

  // Body text
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '');
  console.log('\n=== PAGE TEXT ===');
  console.log(bodyText);

  // All images
  const imgs = await page.$$eval('img', els => els.map(el => ({
    src: el.src, alt: el.alt, w: el.naturalWidth, h: el.naturalHeight
  })).filter(i => i.src && i.src.startsWith('http')));
  console.log(`\n=== IMAGES (${imgs.length}) ===`);
  imgs.slice(0, 20).forEach(i => console.log(`  ${i.w}x${i.h} | ${i.src.substring(0,100)}`));

  await browser.close();

  // Commit debug files
  execSync('git config user.name "github-actions[bot]"');
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  execSync('git add debug_rivero.png debug_rivero.html');
  const st = execSync('git status --porcelain').toString().trim();
  if (st) {
    execSync('git commit -m "DEBUG: rivero.website page capture"');
    execSync('git push');
    console.log('\nDEBUG files committed to repo!');
  }
})();
