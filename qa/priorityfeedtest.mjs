import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES?`${process.env.CODEX_NODE_MODULES}/playwright`:'playwright');
const BASE=process.env.RADAR_BASE_URL||'https://chwijun-radar.vercel.app/';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const context=await browser.newContext({serviceWorkers:'block'});
let writes=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**',route=>{
  if(route.request().method()!=='GET'){writes++;return route.abort('blockedbyclient');}
  return route.continue();
});
const page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('jobRadarStateV3',JSON.stringify({events:[],axes:{},inbox:[],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},seedVersion:2,resultVersion:1,updatedAt:Date.now(),profile:{done:true,pdb:false,name:'우선순위QA',jobs:['사업개발','영업기획','전략기획','디자인'],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}})));
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('jobRadarStateV3')||'{}').radarMeta?.feedStatus==='ok',{timeout:15000});
const result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('jobRadarStateV3'));return {items:s.inbox.filter(x=>['한화에어로스페이스','GS건설','NAVER','신세계프라퍼티','현대건설','토스플레이스','오늘의집','우리카드','마이리얼트립'].includes(x.company)).map(x=>({company:x.company,role:x.role,date:x.schedule?.[0]?.date,time:x.schedule?.[0]?.time})),spaceMatches:{development:window.__dbg.feedRoleMatch('부동산 개발'),leasing:window.__dbg.feedRoleMatch('리징(브랜드MD/상업공간기획)'),storeOps:window.__dbg.feedRoleMatch('매장 현장 운영'),managementGeneral:window.__dbg.feedRoleMatch('지원본부-경영일반')},radarText:document.getElementById('radarStatus')?.innerText.replace(/\s+/g,' ').trim(),version:[...document.scripts].map(x=>x.src).find(x=>x.includes('app.js'))};});
// 한화에어로스페이스·GS건설의 9/20 공고처럼 이미 마감된 항목을
// 고정 기대값으로 남겨 두면 정상적인 active=false 처리도 회귀로 오판한다.
const expected=['NAVER','신세계프라퍼티','현대건설','토스플레이스','오늘의집','우리카드','마이리얼트립'];
const expectedSpaceRoles=['부동산 개발','리징(브랜드MD/상업공간기획)'];
const expectedTodayHouseRoles=['주니어 B2B 영업 담당자(전환형)','Business Development Assistant (인턴)','Marketing Design Assistant (인턴)'];
const todayKst=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(expected.some(c=>!result.items.some(x=>x.company===c))||expectedSpaceRoles.some(role=>!result.items.some(x=>x.company==='신세계프라퍼티'&&x.role===role))||expectedTodayHouseRoles.some(role=>!result.items.some(x=>x.company==='오늘의집'&&x.role===role))||result.items.some(x=>x.company==='오늘의집'&&x.role==='Junior Business Partnership Manager (전환형)')||!result.items.some(x=>x.company==='마이리얼트립'&&x.role==='마이리얼트립 신입 공개채용 (~10/11)'&&x.date==='2026-10-11'&&x.time==='23:59')||!result.items.some(x=>x.company==='현대건설'&&x.role==='지원본부-경영일반')||result.items.some(x=>x.date<todayKst)||!result.spaceMatches.development||!result.spaceMatches.leasing||result.spaceMatches.storeOps||!result.spaceMatches.managementGeneral||!result.version?.includes('8.1.23')) throw new Error(`priority feed failed: ${JSON.stringify({...result,todayKst})}`);
if(writes) throw new Error(`production QA attempted ${writes} write(s)`);
console.log(JSON.stringify({...result,productionWrites:writes},null,2));
await browser.close();
