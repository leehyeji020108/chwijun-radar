import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');
const APP = process.env.RADAR_BASE_URL || 'http://127.0.0.1:8765/';
const appOrigin = new URL(APP).origin;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const context = await browser.newContext({ serviceWorkers: 'block' });
let productionRequests = 0;

const items = [
  ['부동산 개발', 'development'],
  ['리징(브랜드MD/상업공간기획)', 'leasing'],
  ['매장 현장 운영', 'store-ops'],
].map(([role, id]) => ({
  feed_key: `신세계프라퍼티|${id}|2026-10-12|official`,
  company: '신세계프라퍼티', role, deadline: '2026-10-12',
  official_url: 'https://job.shinsegae.com/rcrut/detail/5362',
  published_at: new Date().toISOString(), active: true,
  payload: { company: '신세계프라퍼티', role, url: 'https://job.shinsegae.com/rcrut/detail/5362', schedule: [{ stage: 'apply', date: '2026-10-12', time: '18:00' }] },
}));

await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && url.port === '8878') {
    const body = url.pathname.includes('radar_feed_status')
      ? JSON.stringify([{ status: 'ok', completed_at: new Date().toISOString(), candidate_count: items.length, checked_company_count: 50 }])
      : JSON.stringify(items);
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  }
  if (url.origin === appOrigin) return route.continue();
  if (url.hostname === 'qxejfgbrszcnejkrgiwu.supabase.co') productionRequests++;
  return route.abort('blockedbyclient');
});

await context.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events: [], axes: {}, inbox: [], dismissed: [], archived: {}, qualifications: [], outProposals: [], ignoredOut: {},
  radarSeen: {}, radarIdentity: {}, seedVersion: 2, resultVersion: 1, updatedAt: Date.now(),
  profile: { done: true, pdb: false, name: '공간기획QA', jobs: ['사업개발'], axisOrder: [], criteria: {}, excludeCompanies: [], excludeRoles: [], strength: '', want: '', avoid: '', prompt: '', createdAt: Date.now() },
})));

const page = await context.newPage();
await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => JSON.parse(localStorage.getItem('jobRadarStateV3') || '{}').radarMeta?.feedStatus === 'ok', { timeout: 15000 });
const result = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return {
    roles: state.inbox.map(x => x.role),
    direct: {
      development: window.__dbg.feedRoleMatch('부동산 개발'),
      leasing: window.__dbg.feedRoleMatch('리징(브랜드MD/상업공간기획)'),
      storeOps: window.__dbg.feedRoleMatch('매장 현장 운영'),
    },
    version: [...document.scripts].map(x => x.src).find(x => x.includes('app.js')),
  };
});

if (!result.roles.includes('부동산 개발') || !result.roles.includes('리징(브랜드MD/상업공간기획)') || result.roles.includes('매장 현장 운영')) throw new Error(`space feed failed: ${JSON.stringify(result)}`);
if (!result.direct.development || !result.direct.leasing || result.direct.storeOps) throw new Error(`space matcher failed: ${JSON.stringify(result)}`);
if (!result.version?.includes('8.1.23')) throw new Error(`version failed: ${JSON.stringify(result)}`);
if (productionRequests) throw new Error(`production Supabase requests attempted: ${productionRequests}`);

console.log(JSON.stringify(result, null, 2));
await browser.close();
