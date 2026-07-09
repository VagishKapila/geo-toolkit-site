import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    const entry = `[${msg.type()}] ${msg.text()}`;
    logs.push(entry);
    if (msg.type() === 'error') errors.push(entry);
  });

  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  console.log('=== PAGE LOAD ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log('Console errors on load:', errors.length ? errors : '(none)');
  console.log('All console on load:', logs.filter((l) => !l.includes('[AUDIT]') && !l.includes('[MIC]') && !l.includes('[SCAN]') && !l.includes('[STT]')));

  console.log('\n=== CLICK ACTIVATE SOREN ===');
  const beforeActivate = logs.length;
  const beforeErrors = errors.length;
  await page.getByRole('button', { name: /Activate Soren/i }).click();
  await page.waitForTimeout(1000);
  const activateLogs = logs.slice(beforeActivate);
  const activateErrors = errors.slice(beforeErrors);
  console.log('New logs:', activateLogs.length ? activateLogs : '(none)');
  console.log('New errors:', activateErrors.length ? activateErrors : '(none)');

  console.log('\n=== SCAN varshyl.com ===');
  const beforeScan = logs.length;
  const beforeScanErrors = errors.length;
  await page.getByPlaceholder('varshyl.com').fill('varshyl.com');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page.waitForTimeout(5000);
  const scanLogs = logs.slice(beforeScan);
  const scanErrors = errors.slice(beforeScanErrors);
  console.log('New logs:', scanLogs.length ? scanLogs : '(none)');
  console.log('New errors:', scanErrors.length ? scanErrors : '(none)');

  const overlay = await page.locator('text=SOREN HEARD').count();
  const scanning = await page.locator('text=SCANNING').count();
  console.log('URL confirm overlay visible:', overlay > 0);
  console.log('Scanning toast/state hints:', await page.locator('text=Scanning').count());

  console.log('\n=== FAILED NETWORK REQUESTS ===');
  console.log(failedRequests.length ? failedRequests : '(none)');

  console.log('\n=== ALL CONSOLE (full) ===');
  logs.forEach((l) => console.log(l));

  await browser.close();
}

run().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
