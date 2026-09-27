import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES?`${process.env.CODEX_NODE_MODULES}/playwright`:'playwright');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const BASE=process.env.RADAR_BASE_URL||'https://chwijun-radar.vercel.app/';
const context=await browser.newContext({serviceWorkers:'block'});
let writes=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**',async route=>{
  if(route.request().method()!=='GET'){writes++;return route.abort('blockedbyclient');}
  return route.continue();
});
const page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('jobRadarStateV3',JSON.stringify({events:[],axes:{},inbox:[],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},seedVersion:2,resultVersion:1,updatedAt:Date.now(),profile:{done:true,pdb:false,name:'친구운영QA',jobs:['연구 쪽'],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}})));
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('jobRadarStateV3')||'{}').radarMeta?.feedStatus==='ok',{timeout:15000});
const result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('jobRadarStateV3'));return {count:s.inbox.length,roles:s.inbox.map(x=>x.role),personalPlanCount:s.events.filter(x=>x.stage==='plan').length,version:[...document.scripts].map(x=>x.src).find(x=>x.includes('app.js'))};});
const researchRoles=result.roles.filter(role=>/연구|r&d|공정|설계|ai/i.test(role));
if(result.count<14||researchRoles.length<10||!result.version?.includes('8.1.22')) throw new Error(`production R&D feed failed: ${JSON.stringify({...result,researchRoles})}`);
if(result.personalPlanCount!==0) throw new Error(`personal plan leaked into a new/friend Radar: ${result.personalPlanCount}`);
if(writes) throw new Error(`production QA attempted ${writes} write(s)`);
console.log(JSON.stringify({count:result.count,researchCount:researchRoles.length,personalPlanCount:result.personalPlanCount,roles:[...new Set(result.roles)].sort(),version:result.version,productionWrites:writes},null,2));
await browser.close();
