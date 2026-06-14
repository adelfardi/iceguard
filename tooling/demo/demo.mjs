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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // ── 1. Catalogs: cards with colored tags + filter ──
  await goto('/catalogs');
  await page.mouse.move(640, 360, { steps: 15 });
  await sleep(1700);
  // Filter to the prod + pre-prod environments (hides untagged/external catalogs).
  await hoverClick(page.getByRole('button', { name: 'prod', exact: true }), 900);
  await hoverClick(page.getByRole('button', { name: 'pre-prod', exact: true }), 1800);

  // ── 2. Add Catalog wizard — engine step with real logos ──
  await goto('/catalogs/new');
  await sleep(1200);
  // Pick the Nessie engine card
  const nessie = page.getByRole('button').filter({ hasText: 'Nessie' });
  await hoverClick(nessie, 1100);
  // Next → Connection, fill name + URI
  await hoverClick(page.getByRole('button', { name: 'Next' }), 800);
  await typeInto(page.locator('#name'), 'orders-preprod');
  await sleep(300);
  await typeInto(page.locator('#uri'), 'http://nessie-catalog:8181');
  await sleep(700);
  // Next → Credentials
  await hoverClick(page.getByRole('button', { name: 'Next' }), 1300);
  // Next → Tags
  await hoverClick(page.getByRole('button', { name: 'Next' }), 800);
  const tagInput = page.getByPlaceholder('Add a tag and press Enter');
  await typeInto(tagInput, 'prod', 110);
  await page.keyboard.press('Enter');
  await sleep(400);
  await typeInto(tagInput, 'demo', 110);
  await page.keyboard.press('Enter');
  await sleep(1600);

  // ── 3. Table detail — Overview gauges ──
  await goto('/catalogs/1/namespaces/analytics/tables/events');
  await sleep(2000);

  // Metadata tab (schema / partitions / properties sub-tabs)
  await hoverClick(page.getByRole('tab', { name: /Metadata/i }), 1300);
  await hoverClick(page.getByRole('tab', { name: /Partitions/i }), 1100);
  await hoverClick(page.getByRole('tab', { name: /Properties/i }), 1100);

  // Snapshots tab (operation icons, newest first)
  await hoverClick(page.getByRole('tab', { name: /Snapshots/i }), 1800);

  // Storage tab (health card) → scroll down to the partition navigator
  await hoverClick(page.getByRole('tab', { name: /Storage/i }), 1600);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 320); await sleep(450); }
  await sleep(1500);
  await page.mouse.wheel(0, -1400);
  await sleep(700);

  // Timeline (snapshots + executions)
  await hoverClick(page.getByRole('tab', { name: /Timeline/i }), 2000);

  // Lineage (schema-version history)
  await hoverClick(page.getByRole('tab', { name: /Lineage/i }), 2000);

  // Maintenance (expire / rewrite / rollback actions)
  await hoverClick(page.getByRole('tab', { name: /Maintenance/i }), 2000);

  // Alerts (threshold rules)
  await hoverClick(page.getByRole('tab', { name: /Alerts/i }), 2000);

  // ── 4. Pipelines page ──
  await goto('/pipelines');
  await sleep(2200);

  await page.close();
  await context.close();
  await browser.close();

  const video = await page.video()?.path();
  console.log('VIDEO=' + video);
}

run().catch((e) => { console.error(e); process.exit(1); });
