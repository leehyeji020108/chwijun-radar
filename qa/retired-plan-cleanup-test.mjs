import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');
const BASE = process.env.RADAR_BASE_URL || 'http://127.0.0.1:8765/';
const baseOrigin = new URL(BASE).origin;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const routeSafe = async route => {
  const url = new URL(route.request().url());
  if (url.origin === baseOrigin) return route.continue();
  if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ status:200, contentType:'text/css', body:'' });
  return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
};

const context = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
await context.route('**/*', routeSafe);
await context.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events:[
    { id:'kia', company:'기아', role:'SDV 전략기획', tier:'S', date:'2026-09-29', time:'11:00', stage:'apply', kind:'deadline', result:'', hold:false, progress:0, note:'', url:'' },
    { id:'plan-20260919-toeic', company:'TOEIC Speaking', role:'응시', tier:'-', date:'2026-09-19', time:'', stage:'plan', kind:'event', result:'', hold:false, progress:0, note:'개인 실행계획', url:'' },
    { id:'custom-manual', company:'사용자 일정', role:'직접 만든 일정', tier:'A', date:'2026-09-20', time:'', stage:'info', kind:'event', result:'', hold:false, progress:0, note:'보존', url:'' }
  ],
  axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{}, radarSeen:{}, radarIdentity:{},
  seedVersion:2, planVersion:1, resultVersion:1, updatedAt:Date.now(),
  profile:{ done:true, pdb:false, name:'복구 QA', jobs:['전략기획'], axisOrder:[], criteria:{}, excludeCompanies:[], excludeRoles:[], strength:'', want:'', avoid:'', prompt:'', createdAt:Date.now() }
})));
const page = await context.newPage();
await page.goto(BASE, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1000);
const result = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { ids:state.events.map(x => x.id), planVersion:Object.hasOwn(state, 'planVersion'), version:[...document.scripts].map(x => x.src).find(x => x.includes('app.js')), text:document.body.innerText };
});
assert.deepEqual(result.ids.sort(), ['custom-manual','kia','user-cj-first','user-hanwha-finance','user-myrealtrip','user-naver-cloud']);
assert.equal(result.planVersion, false);
assert.match(result.version, /8\.1\.22/);
assert.doesNotMatch(result.text, /TOEIC Speaking/);

const friendContext = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
await friendContext.route('**/*', routeSafe);
await friendContext.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events:[], axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{}, radarSeen:{}, radarIdentity:{},
  seedVersion:2, resultVersion:1, updatedAt:Date.now(),
  profile:{ done:true, pdb:false, name:'친구 QA', jobs:['연구개발'], axisOrder:[], criteria:{}, excludeCompanies:[], excludeRoles:[], strength:'', want:'', avoid:'', prompt:'', createdAt:Date.now() }
})));
const friendPage = await friendContext.newPage();
await friendPage.goto(BASE, { waitUntil:'domcontentloaded' });
await friendPage.waitForTimeout(1000);
const friendCount = await friendPage.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
assert.equal(friendCount, 0);
console.log(JSON.stringify({ ids:result.ids, planVersionPresent:result.planVersion, friendPersonalApplications:friendCount, version:result.version }, null, 2));
await browser.close();
