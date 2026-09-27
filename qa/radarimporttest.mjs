import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright`
  : 'playwright');

const CHROME = process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath:CHROME });
const context = await browser.newContext({ serviceWorkers:'block' });
await context.grantPermissions(['clipboard-read','clipboard-write'], { origin:'http://127.0.0.1:8899' });
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**', route => route.abort('blockedbyclient'));
const page = await context.newPage();
await page.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events:[], axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{},
  seedVersion:2, resultVersion:1, updatedAt:Date.now(),
  profile:{ done:true, pdb:false, name:'레이더QA', jobs:['전략기획','사업개발'], axisOrder:[], criteria:{},
    excludeCompanies:[], excludeRoles:[], strength:'', want:'', avoid:'', prompt:'', createdAt:Date.now() }
})));
await page.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await page.click('.tab[data-tab="more"]');
if(await page.$('[data-go="importSheet"]')) throw new Error('obsolete manual import is still visible in More');
const labels=await page.$$eval('#s-more .rowT',nodes=>nodes.map(x=>x.textContent.trim()));
if(!labels.includes('휴대폰과 연결')||!labels.includes('지원 기준 수정')) throw new Error(`More cleanup missing: ${labels.join(',')}`);
await page.evaluate(() => window.__dbg.openSheet('impBg'));
await page.click('#viewPromptBtn');
const prompt = await page.inputValue('#promptBox');
if (!prompt.includes('최소 30개 서로 다른 기업')) throw new Error('broad search guard missing');

const payload = JSON.stringify({ items:[{
  company:'레이더테스트', role:'전략기획', tier:'S', jd:'사업 전략', require:'전공 무관', english:'',
  note:'검증', url:'https://example.com/jobs/1', schedule:[{stage:'apply',date:'2026-10-01',time:'18:00'}]
}], out:[], checks:[] });
await page.evaluate(async value => navigator.clipboard.writeText(value), payload);
await page.click('#clipboardImportBtn');
await page.waitForTimeout(900);
const result = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { inbox:state.inbox.length, meta:state.radarMeta,
    syncText:document.getElementById('syncText')?.textContent || '' };
});
if (result.inbox !== 1 || !result.meta?.lastImportAt || result.meta.lastNewCount !== 1)
  throw new Error(`clipboard import/freshness failed: ${JSON.stringify(result)}`);
if (result.syncText.includes('레이더')) throw new Error('radar status leaked into device sync status');
console.log(JSON.stringify({ promptBreadth:true, clipboardImport:true, freshness:true, syncSeparated:true }, null, 2));
await browser.close();
