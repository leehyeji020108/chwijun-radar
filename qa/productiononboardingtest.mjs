import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright`
  : 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const BASE = process.env.RADAR_BASE_URL || 'https://chwijun-radar.vercel.app/';
const context = await browser.newContext({ serviceWorkers: 'block' });
let productionWrites = 0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**', route => {
  if (route.request().method() !== 'GET') {
    productionWrites++;
    return route.abort('blockedbyclient');
  }
  return route.continue();
});

const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#onboard:not([hidden])');
await page.click('#obNext');
await page.fill('#i_name', '운영신규QA');
await page.click('#obNext');
await page.click('[data-job="R&D·연구개발"]');
for (let i = 0; i < 5; i++) await page.click('#obNext');

const done = await page.evaluate(() => ({
  title: document.querySelector('.obTitle')?.textContent.replace(/\s+/g, ' ').trim(),
  hasKeyStep: !!document.getElementById('obKeyVal'),
  syncCfg: localStorage.getItem('jobRadarSyncCfg'),
  version: [...document.scripts].map(x => x.src).find(x => x.includes('app.js'))
}));
if (!done.title?.includes('준비 끝났습니다') || done.hasKeyStep || done.syncCfg || !done.version?.includes('8.1.22')) {
  throw new Error(`production onboarding path failed: ${JSON.stringify(done)}`);
}

await page.click('#obNext');
await page.waitForFunction(() => document.getElementById('onboard').hidden);
const result = await page.evaluate(() => ({
  cfg: localStorage.getItem('jobRadarSyncCfg'),
  bannerHidden: document.getElementById('syncBar')?.hidden,
  profileDone: JSON.parse(localStorage.getItem('jobRadarStateV3') || '{}').profile?.done
}));
if (result.cfg || !result.bannerHidden || !result.profileDone || productionWrites) {
  throw new Error(`production local-only state failed: ${JSON.stringify({ ...result, productionWrites })}`);
}

console.log(JSON.stringify({ ...done, ...result, productionWrites }, null, 2));
await browser.close();
