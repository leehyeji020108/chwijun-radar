import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES?`${process.env.CODEX_NODE_MODULES}/playwright`:'playwright');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const BASE=process.env.RADAR_BASE_URL||'https://chwijun-radar.vercel.app/';
const context=await browser.newContext({serviceWorkers:'block'});
let writes=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**', async route=>{
  if(route.request().method()!=='GET'){writes++;return route.abort('blockedbyclient');}
  return route.continue();
});
const page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('jobRadarStateV3',JSON.stringify({
  events:[],axes:{},inbox:[],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},
  seedVersion:2,resultVersion:1,updatedAt:Date.now(),profile:{done:true,pdb:false,name:'운영읽기QA',jobs:[],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}
})));
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('jobRadarStateV3')||'{}').radarMeta?.feedStatus==='ok',{timeout:15000});
const result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('jobRadarStateV3'));return {count:s.inbox?.length||0,status:s.radarMeta?.feedStatus,coverage:s.radarMeta?.feedCoverage,checked:s.radarMeta?.feedCheckedCompanies,candidates:s.radarMeta?.feedCandidateCount,radarText:document.getElementById('radarStatus')?.textContent||'',radarError:document.getElementById('radarStatus')?.classList.contains('is-error'),version:[...document.scripts].map(x=>x.src).find(x=>x.includes('app.js'))};});
const expectedCoverage=result.checked>=50?'complete':'partial';
const expectedStatusText=expectedCoverage==='complete'?'최신':'일부 사이트 확인 지연';
const statusCopyOk=result.radarText.includes(expectedStatusText)||result.radarText.includes('업데이트 필요');
if(result.count<1||result.status!=='ok'||result.coverage!==expectedCoverage||!Number.isFinite(result.checked)||result.checked<0||!Number.isFinite(result.candidates)||result.candidates<result.count||result.radarError||!statusCopyOk||!result.version?.includes('8.1.23')) throw new Error(`production feed failed: ${JSON.stringify({...result,expectedCoverage,expectedStatusText})}`);
await page.click('.tab[data-tab="more"]');
const more=await page.evaluate(()=>({
  labels:[...document.querySelectorAll('#s-more .rowT')].map(x=>x.textContent.trim()),
  manualImport:!!document.querySelector('#s-more [data-go="importSheet"]'),
  syncSum:document.getElementById('syncSum')?.textContent.trim()
}));
if(more.manualImport||!more.labels.includes('휴대폰과 연결')||!more.labels.includes('지원 기준 수정')) throw new Error(`production More cleanup failed: ${JSON.stringify(more)}`);
if(writes) throw new Error(`production QA attempted ${writes} write(s)`);
console.log(JSON.stringify({...result,...more,productionWrites:writes},null,2));
await browser.close();
