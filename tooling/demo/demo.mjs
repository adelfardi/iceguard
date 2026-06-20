import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_BASE || 'http://localhost:5173';
const OUT = path.join(__dirname, 'out');
const VIEWPORT = { width: 1280, height: 720 };

// Injected once per navigation: a fake cursor that follows real mouse events,
// so page.mouse.move(...) produces a visible pointer in the recording.
const CURSOR_SCRIPT = `
  (() => {
    if (window.__pwCursor) return;
    const c = document.createElement('div');
    c.id = 'pw-cursor';
    Object.assign(c.style, {
      position: 'fixed', top: '0', left: '0', width: '22px', height: '22px',
      borderRadius: '50%', background: 'rgba(99,102,241,0.35)',
      border: '2px solid rgba(129,140,248,0.95)', boxShadow: '0 0 12px rgba(99,102,241,0.8)',
      zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-50%, -50%)',
      transition: 'width .12s, height .12s', left: '-50px',
    });
    const add = () => (document.body ? document.body.appendChild(c) : requestAnimationFrame(add));
    add();
    window.__pwCursor = c;
    document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { c.style.width = '14px'; c.style.height = '14px'; }, true);
    document.addEventListener('mouseup', () => { c.style.width = '22px'; c.style.height = '22px'; }, true);
  })();
`;

// Force the light theme before the app boots (zustand-persist store key).
const THEME_SCRIPT = `
  try { localStorage.setItem('iceguard-theme', JSON.stringify({ state: { theme: 'light' }, version: 0 })); } catch (e) {}
  document.documentElement.classList.remove('dark');
`;

// Global pacing factor (<1 = snappier) to keep the long walkthrough GIF reasonable.
const PACE = Number(process.env.DEMO_PACE || 0.7);
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.round(ms * PACE)));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: VIEWPORT },
  });
  await context.addInitScript(THEME_SCRIPT);
  await context.addInitScript(CURSOR_SCRIPT);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  async function typeInto(locator, text, delay = 70) {
    await moveTo(locator);
    await locator.first().click();
    for (const ch of text) { await page.keyboard.type(ch); await sleep(delay); }
  }

  // Move the fake cursor to an element's center, in smooth steps.
  async function moveTo(locator) {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const box = await el.boundingBox();
    if (!box) return null;
    const x = box.x + box.width / 2;
    const y = box.y + Math.min(box.height / 2, 18);
    await page.mouse.move(x, y, { steps: 25 });
    return { x, y };
  }
  async function hoverClick(locator, settle = 600) {
    await moveTo(locator);
    await sleep(350);
    await locator.first().click();
    await sleep(settle);
  }
  async function goto(url) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(900);
  }

  // ── 1. Table detail — start here, walk every section ──
  await goto('/catalogs/1/namespaces/analytics/tables/events');
  await sleep(2300);

  // Metadata (schema / partitions / properties sub-tabs)
  await hoverClick(page.getByRole('tab', { name: /Metadata/i }), 1200);
  await hoverClick(page.getByRole('tab', { name: /Partitions/i }), 1000);
  await hoverClick(page.getByRole('tab', { name: /Properties/i }), 1100);

  // Snapshots (operation icons, newest first)
  await hoverClick(page.getByRole('tab', { name: /Snapshots/i }), 1600);

  // Storage (health) → scroll to the partition navigator, drill into the first partition, back
  await hoverClick(page.getByRole('tab', { name: /Storage/i }), 1500);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await sleep(650); }
  await sleep(1300);
  // open the first partition's file list, dwell on it, then return to the navigator
  await hoverClick(page.locator('tr.cursor-pointer').first(), 1900);
  await sleep(2000);
  await hoverClick(page.getByRole('button', { name: /Back/i }), 1400);
  await sleep(1000);
  await page.mouse.wheel(0, -1400);
  await sleep(600);

  // Timeline → hover an item to surface its tooltip, then click it to open the details popup
  await hoverClick(page.getByRole('tab', { name: /Timeline/i }), 1300);
  try {
    // Pick a data-marker dot in the chart area — not a thin connector stem and not the
    // right-hand filter legend (those are ~40px dots near x≈1016 and would toggle a filter).
    const items = page.locator('.vis-item');
    const count = await items.count();
    let box = null;
    for (let i = 0; i < count; i++) {
      const bb = await items.nth(i).boundingBox();
      if (bb && bb.width >= 10 && bb.width <= 60 && bb.height >= 10 && bb.height <= 60
          && bb.x > 200 && bb.x < 900 && bb.y > 200 && bb.y < 470) { box = bb; break; }
    }
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy, { steps: 22 });
      await page.mouse.move(cx + 1, cy, { steps: 2 });   // nudge so vis-timeline shows the tooltip
      await sleep(2400);                                  // operation · #id · time · +files/records
      await page.mouse.click(cx, cy);                     // → details popup (snapshot / operation output)
      await page.getByRole('dialog').waitFor({ state: 'visible' }).catch(() => {});
      await sleep(2600);                                  // showcase the popup
      await page.keyboard.press('Escape');
      await sleep(800);
    }
  } catch { /* ignore */ }

  // Lineage → scroll all the way down through the schema-evolution history (v0→v3 diffs)
  await hoverClick(page.getByRole('tab', { name: /Lineage/i }), 1300);
  for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, 340); await sleep(480); }
  await sleep(1800);                 // dwell at the bottom on the column diffs
  await page.mouse.wheel(0, -2400);
  await sleep(600);

  // Maintenance → open the "Rewrite Data Files" dialog (popup)
  await hoverClick(page.getByRole('tab', { name: /Maintenance/i }), 1400);
  const rewriteRun = page.locator('div.group')
    .filter({ has: page.getByRole('heading', { name: 'Rewrite Data Files' }) })
    .getByRole('button', { name: 'Run' });
  await hoverClick(rewriteRun, 600);
  await page.getByRole('dialog').waitFor({ state: 'visible' }).catch(() => {});
  await sleep(2600);                 // showcase the popup
  await page.keyboard.press('Escape');
  await sleep(900);

  // Alerts (threshold rules)
  await hoverClick(page.getByRole('tab', { name: /Alerts/i }), 1700);

  // ── 2. Catalogs: realistic names + tag filter ──
  await goto('/catalogs');
  await page.mouse.move(640, 360, { steps: 15 });
  await sleep(1500);
  // Filter to prod + pre-prod (hides the external catalog).
  await hoverClick(page.getByRole('button', { name: 'prod', exact: true }), 800);
  await hoverClick(page.getByRole('button', { name: 'pre-prod', exact: true }), 1800);

  // ── 3. Catalog switcher → namespaces → quick create table ──
  try {
    await hoverClick(page.getByRole('button', { name: 'Select catalog' }), 900);
    await hoverClick(page.getByRole('menuitem').filter({ hasText: 'lakehouse-prod' }), 1700); // → /catalogs/1
    // Expand a namespace (in the main content, not the sidebar tree) → Create Table
    const main = page.locator('main');
    await hoverClick(main.getByRole('button', { name: /^analytics/ }), 1400);
    await hoverClick(main.getByRole('link', { name: /Create Table/i }), 1500);
    // Start the table wizard (just enough to show it)
    await typeInto(page.locator('#table-name'), 'customer_orders');
    await sleep(700);
    await hoverClick(page.getByRole('button', { name: 'Next' }), 1600); // → Columns step
    await sleep(800);
  } catch (e) { console.warn('browse/create-table step skipped:', e.message); }

  // ── 4. Add Catalog wizard — engine step with real logos ──
  await goto('/catalogs/new');
  await sleep(1100);
  const nessie = page.getByRole('button').filter({ hasText: 'Nessie' });
  await hoverClick(nessie, 1000);
  await hoverClick(page.getByRole('button', { name: 'Next' }), 800);
  await typeInto(page.locator('#name'), 'orders-preprod');
  await sleep(300);
  await typeInto(page.locator('#uri'), 'http://nessie-catalog:8181');
  await sleep(600);
  await hoverClick(page.getByRole('button', { name: 'Next' }), 1200);
  await hoverClick(page.getByRole('button', { name: 'Next' }), 800);
  const tagInput = page.getByPlaceholder('Add a tag and press Enter');
  await typeInto(tagInput, 'prod', 110);
  await page.keyboard.press('Enter');
  await sleep(400);
  await typeInto(tagInput, 'demo', 110);
  await page.keyboard.press('Enter');
  await sleep(1500);

  // ── 5. Pipelines — list, then a pipeline's runs ──
  await goto('/pipelines');
  await sleep(1800);
  // Open the pipeline's runs
  await hoverClick(page.getByRole('link', { name: /View Runs/i }), 1800);
  // Expand the latest run to reveal its task flow
  const firstRun = page.locator('button').filter({ hasText: /SUCCESS|RUNNING|FAILED/i }).first();
  await hoverClick(firstRun, 2400);
  await sleep(800);

  await page.close();
  await context.close();
  await browser.close();

  const video = await page.video()?.path();
  console.log('VIDEO=' + video);
}

run().catch((e) => { console.error(e); process.exit(1); });
