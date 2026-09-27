import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright`
  : 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const context = await browser.newContext({ serviceWorkers: 'block' });
let productionWrites = 0;

// 로컬 QA는 운영 Supabase에 쓰지 못한다. feed GET도 로컬 fixture로만 응답한다.
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**', route => {
  if (route.request().method() !== 'GET') productionWrites++;
  return route.abort('blockedbyclient');
});
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_items**', route => route.fulfill({
  status: 200, contentType: 'application/json', body: '[]'
}));
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_status**', route => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify([{
    status: 'ok', completed_at: '2026-09-13T00:00:00Z', candidate_count: 0, checked_company_count: 50
  }])
}));

const page = await context.newPage();
await page.goto('http://127.0.0.1:8899/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#onboard:not([hidden])');

await page.click('#obNext'); // welcome -> basic
await page.fill('#i_name', '신규사용자QA');
await page.click('#obNext'); // basic -> jobs
await page.click('[data-job="R&D·연구개발"]');
await page.click('#obNext'); // jobs -> rank
await page.click('#obNext'); // rank -> criteria
const touchLayout = await page.evaluate(() => {
  const dots=[...document.querySelectorAll('.onboard .dot')].map(x=>x.getBoundingClientRect());
  const wrap=document.querySelector('.onboard .dots')?.getBoundingClientRect();
  return {
    minDot:Math.min(...dots.map(x=>Math.min(x.width,x.height))),
    withinViewport:!!wrap && wrap.left>=0 && wrap.right<=innerWidth,
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth
  };
});
if(touchLayout.minDot<44||!touchLayout.withinViewport||!touchLayout.noHorizontalOverflow) {
  throw new Error(`onboarding touch layout failed: ${JSON.stringify(touchLayout)}`);
}
await page.click('#obNext'); // criteria -> exclude
await page.click('#obNext'); // exclude -> open
await page.click('#obNext'); // open -> done (key 단계가 없어야 함)

const beforeFinish = await page.evaluate(() => ({
  title: document.querySelector('.obTitle')?.textContent.replace(/\s+/g, ' ').trim(),
  hasKeyStep: !!document.querySelector('#obKeyVal'),
  syncCfg: localStorage.getItem('jobRadarSyncCfg')
}));
if (!beforeFinish.title?.includes('준비 끝났습니다') || beforeFinish.hasKeyStep || beforeFinish.syncCfg) {
  throw new Error(`new-user onboarding unexpectedly enabled sync: ${JSON.stringify(beforeFinish)}`);
}

await page.click('#obNext');
await page.waitForFunction(() => document.getElementById('onboard').hidden);
const result = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('jobRadarStateV3') || '{}');
  return {
    profileDone: state.profile?.done,
    jobs: state.profile?.jobs,
    syncCfg: localStorage.getItem('jobRadarSyncCfg'),
    syncBannerHidden: document.getElementById('syncBar')?.hidden,
    moreSyncLabel: (() => {
      document.querySelector('.tab[data-tab="more"]')?.click();
      return [...document.querySelectorAll('#s-more .rowT')].map(x => x.textContent.trim()).find(x => x === '휴대폰과 연결');
    })()
  };
});

if (!result.profileDone || !result.jobs?.includes('R&D·연구개발') || result.syncCfg || !result.syncBannerHidden || result.moreSyncLabel !== '휴대폰과 연결') {
  throw new Error(`local-only onboarding failed: ${JSON.stringify(result)}`);
}
if (productionWrites) throw new Error(`QA attempted ${productionWrites} production write(s)`);

console.log(JSON.stringify({ ...beforeFinish, ...touchLayout, ...result, productionWrites }, null, 2));
await browser.close();
