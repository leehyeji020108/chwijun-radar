import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
let externalRequests = 0;

await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'cdn.jsdelivr.net') {
    return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  }
  if (url.hostname === '127.0.0.1' && ['8878', '8899'].includes(url.port)) {
    if (url.port === '8878') {
      const body = url.pathname.includes('radar_feed_status')
        ? JSON.stringify([{ status: 'ok', completed_at: new Date().toISOString(), candidate_count: 0, checked_company_count: 50 }])
        : '[]';
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
    return route.continue();
  }
  externalRequests++;
  return route.abort('blockedbyclient');
});

await context.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events: [{ id: 'type-1', company: '가독성 검수', role: '사업기획', tier: 'A', date: '2026-09-30', time: '17:00', stage: 'apply', kind: 'deadline', result: '', hold: false, note: '', url: '' }],
  axes: {}, inbox: [], dismissed: [], archived: {}, qualifications: [], outProposals: [], ignoredOut: {}, radarSeen: {}, radarIdentity: {},
  seedVersion: 2, resultVersion: 1, updatedAt: Date.now(),
  profile: { done: true, pdb: false, name: '타이포그래피 QA', jobs: ['기획·전략'], axisOrder: [], criteria: {}, excludeCompanies: [], excludeRoles: [], strength: '', want: '', avoid: '', prompt: '', createdAt: Date.now() }
})));

const page = await context.newPage();
await page.goto(process.env.RADAR_BASE_URL || 'http://127.0.0.1:8899/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.heroTitle');

const result = await page.evaluate(() => {
  const pick = selector => {
    const style = getComputedStyle(document.querySelector(selector));
    return { family: style.fontFamily, weight: style.fontWeight, tracking: style.letterSpacing, lineHeight: style.lineHeight };
  };
  return {
    version: [...document.querySelectorAll('.footNote')].map(node => node.textContent).find(text => text.includes('취준 Radar v')),
    body: pick('body'),
    hero: pick('.heroTitle'),
    section: pick('.blockHead h2'),
    nav: pick('.tab span')
  };
});

assert.match(result.version, /v8\.1\.22/);
assert.match(result.body.family, /Pretendard/);
assert.equal(result.body.weight, '400');
assert.equal(result.hero.weight, '700');
assert.equal(result.section.weight, '650');
assert.equal(result.nav.tracking, 'normal');
assert.equal(externalRequests, 0);

console.log(JSON.stringify({ ...result, externalRequests }, null, 2));
await browser.close();
