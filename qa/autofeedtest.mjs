import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');

const CHROME = process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath:CHROME });
const context = await browser.newContext({ serviceWorkers:'block' });
let productionRequests = 0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**', route => {
  productionRequests++; return route.abort('blockedbyclient');
});
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_items**', route => route.fulfill({
  status:200, contentType:'application/json', body:JSON.stringify([
    {feed_key:'fixture-1',company:'자동피드회사',role:'전략기획',deadline:'2099-10-01',official_url:'https://example.test/job/1',published_at:'2026-09-12T00:00:00Z',payload:{company:'자동피드회사',role:'전략기획',tier:'A',url:'https://example.test/job/1',schedule:[{stage:'apply',date:'2099-10-01',time:'18:00'}]}},
    {feed_key:'fixture-2',company:'토스플레이스',role:'Enterprise Marketing Manager',deadline:null,official_url:'https://example.test/job/2',published_at:'2026-09-12T00:00:00Z',payload:{company:'토스플레이스',role:'Enterprise Marketing Manager',tier:'A',url:'https://example.test/job/2',match_terms:'마케팅 영업기획 사업개발',schedule:[{stage:'info',date:'2099-09-21',time:''}]}},
    {feed_key:'fixture-3',company:'우리카드',role:'일반직군',deadline:'2099-09-21',official_url:'https://example.test/job/3',published_at:'2026-09-12T00:00:00Z',payload:{company:'우리카드',role:'일반직군',tier:'A',url:'https://example.test/job/3',match_terms:'사업기획 마케팅 상품기획',schedule:[{stage:'apply',date:'2099-09-21',time:'17:00'}]}}
  ])
}));
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_status**', route => route.fulfill({
  status:200, contentType:'application/json', body:JSON.stringify([{
    status:'ok', completed_at:new Date().toISOString(), candidate_count:3, checked_company_count:30
  }])
}));
const page = await context.newPage();
await page.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events:[], axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{},
  radarSeen:{}, radarIdentity:{}, seedVersion:2, resultVersion:1, updatedAt:Date.now(),
  profile:{ done:true, pdb:false, name:'자동피드QA', jobs:['전략기획','사업기획','마케팅'], axisOrder:[], criteria:{},
    excludeCompanies:[], excludeRoles:[], strength:'', want:'', avoid:'', prompt:'', createdAt:Date.now() }
})));
await page.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await page.waitForFunction(() => {
  const s=JSON.parse(localStorage.getItem('jobRadarStateV3')||'{}');
  return s.radarMeta?.feedStatus==='ok';
});
const first=await page.evaluate(() => {
  const s=JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return {count:s.inbox.length, companies:s.inbox.map(x=>x.company).sort(), seen:s.radarSeen?.['fixture-1'],
    feedStatus:s.radarMeta?.feedStatus, feedCoverage:s.radarMeta?.feedCoverage,
    radarText:document.querySelector('#radarStatus')?.textContent||'',
    radarError:document.querySelector('#radarStatus')?.classList.contains('is-error'),
    syncText:document.querySelector('#syncText')?.textContent||''};
});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForTimeout(300);
const second=await page.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).inbox.length);
if(first.count!==3||!['우리카드','자동피드회사','토스플레이스'].every(x=>first.companies.includes(x))||!first.seen||first.feedStatus!=='ok'||first.feedCoverage!=='partial'||first.radarError||!first.radarText.includes('일부 사이트 확인 지연'))
  throw new Error(`automatic feed failed: ${JSON.stringify(first)}`);
if(second!==3) throw new Error(`feed dedupe failed: ${second}`);
if(first.syncText.includes('채용 레이더')) throw new Error('feed state leaked into device sync status');
if(productionRequests!==0) throw new Error(`test contacted production Supabase: ${productionRequests}`);
console.log(JSON.stringify({automaticFetch:true,partialCoverageIsNotFailure:true,dedupe:true,deviceSyncSeparated:true,productionFailClosed:true},null,2));
await browser.close();
