import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES?`${process.env.CODEX_NODE_MODULES}/playwright`:'playwright');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const context=await browser.newContext({serviceWorkers:'block'});
let productionHits=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**',r=>{productionHits++;return r.abort('blockedbyclient');});
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_items**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
  {feed_key:'rd-1',company:'R&D회사',role:'연구개발',deadline:'2026-09-30',official_url:'https://example.test/rd',published_at:'2026-09-13T00:00:00Z',payload:{company:'R&D회사',role:'연구개발',url:'https://example.test/rd',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'rd-2',company:'공정회사',role:'공정기술',deadline:'2026-09-30',official_url:'https://example.test/process',published_at:'2026-09-13T00:00:00Z',payload:{company:'공정회사',role:'공정기술',url:'https://example.test/process',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'rd-3',company:'소재회사',role:'소재개발',deadline:'2026-09-30',official_url:'https://example.test/material',published_at:'2026-09-13T00:00:00Z',payload:{company:'소재회사',role:'소재개발',url:'https://example.test/material',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'rd-4',company:'AI회사',role:'AI/Data 기획 및 운영',deadline:'2026-09-30',official_url:'https://example.test/ai',published_at:'2026-09-13T00:00:00Z',payload:{company:'AI회사',role:'AI/Data 기획 및 운영',url:'https://example.test/ai',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'sales-1',company:'영업회사',role:'기술영업직',deadline:'2026-09-30',official_url:'https://example.test/sales',published_at:'2026-09-13T00:00:00Z',payload:{company:'영업회사',role:'기술영업직',url:'https://example.test/sales',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'bizdev-1',company:'호텔회사',role:'호텔-경영지원(사업개발)',deadline:'2026-09-30',official_url:'https://example.test/bizdev',published_at:'2026-09-13T00:00:00Z',payload:{company:'호텔회사',role:'호텔-경영지원(사업개발)',url:'https://example.test/bizdev',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'build-1',company:'건설회사',role:'기술직(데이터센터):건축',deadline:'2026-09-30',official_url:'https://example.test/build',published_at:'2026-09-13T00:00:00Z',payload:{company:'건설회사',role:'기술직(데이터센터):건축',url:'https://example.test/build',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}},
  {feed_key:'biz-1',company:'기획회사',role:'전략기획',deadline:'2026-09-30',official_url:'https://example.test/biz',published_at:'2026-09-13T00:00:00Z',payload:{company:'기획회사',role:'전략기획',url:'https://example.test/biz',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]}}
])}));
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_status**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{status:'ok',completed_at:new Date().toISOString(),candidate_count:6,checked_company_count:50}])}));
const page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('jobRadarStateV3',JSON.stringify({events:[],axes:{},inbox:[],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},seedVersion:2,resultVersion:1,updatedAt:Date.now(),profile:{done:true,pdb:false,name:'친구QA',jobs:['연구 쪽'],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}})));
await page.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('jobRadarStateV3')||'{}').radarMeta?.feedStatus==='ok');
const result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('jobRadarStateV3'));return {count:s.inbox.length,roles:s.inbox.map(x=>x.role)};});
const expected=['연구개발','공정기술','소재개발','AI/Data 기획 및 운영'];
if(result.count!==expected.length||expected.some(x=>!result.roles.includes(x))||result.roles.includes('기술영업직')||result.roles.includes('전략기획'))
  throw new Error(`research-adjacent filtering failed: ${JSON.stringify(result)}`);
const variants=await page.evaluate(()=>{
  const s=window.__dbg.state(), out={};
  for(const job of ['연구','연구 쪽','기술연구','R&D(연구개발)']){
    s.profile.jobs=[job];
    out[job]=['연구개발','공정기술','소재개발','AI/Data 기획 및 운영'].every(r=>window.__dbg.feedRoleMatch(r))
      && !['기술영업직','전략기획','호텔-경영지원(사업개발)','기술직(데이터센터):건축','데이터기획직'].some(r=>window.__dbg.feedRoleMatch(r));
  }
  return out;
});
if(Object.values(variants).some(x=>!x)) throw new Error(`research input variants failed: ${JSON.stringify(variants)}`);
await page.click('.tab[data-tab="inbox"]');
const ux=await page.evaluate(()=>({
  radarStatus:document.getElementById('radarStatus')?.innerText.replace(/\s+/g,' ').trim(),
  actions:[...document.querySelectorAll('.inBtns .btn')].map(x=>x.textContent.trim()),
  lead:document.querySelector('#s-inbox .lead')?.textContent.replace(/\s+/g,' ').trim()
}));
if(!ux.radarStatus?.includes('검토 대기 4건')||!ux.actions.includes('이 회사·직무 제외')
  ||!ux.actions.includes('지원 Radar에 추가')||!ux.lead?.includes('지원 Radar')) {
  throw new Error(`inbox UX wording failed: ${JSON.stringify(ux)}`);
}
if(productionHits) throw new Error(`local test contacted production: ${productionHits}`);
console.log(JSON.stringify({...result,variants,...ux,productionFailClosed:true},null,2));
await browser.close();
