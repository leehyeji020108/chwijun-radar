import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES?`${process.env.CODEX_NODE_MODULES}/playwright`:'playwright');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const context=await browser.newContext({serviceWorkers:'block'});
let productionHits=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**',r=>{productionHits++;return r.abort('blockedbyclient');});
await context.route('http://127.0.0.1:8878/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
const page=await context.newPage();
await page.addInitScript(()=>{
  window.__badgeCalls=[];
  Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async n=>window.__badgeCalls.push(['set',n])});
  Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.__badgeCalls.push(['clear'])});
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted',requestPermission:async()=>'granted'}});
  localStorage.setItem('jobRadarStateV3',JSON.stringify({events:[],axes:{},inbox:[
    {company:'연구A',role:'연구개발',url:'https://example.test/a',schedule:[{stage:'apply',date:'2026-09-30',time:'17:00'}]},
    {company:'연구B',role:'소재개발',url:'https://example.test/b',schedule:[{stage:'apply',date:'2026-10-01',time:'17:00'}]}
  ],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},seedVersion:2,resultVersion:1,updatedAt:Date.now(),profile:{done:true,pdb:false,name:'배지QA',jobs:['연구'],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}}));
});
await page.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await page.click('.tab[data-tab="more"]');
await page.click('#badgeBtn');
await page.waitForFunction(()=>window.__badgeCalls.some(x=>x[0]==='set'&&x[1]===2));
const enabled=await page.evaluate(()=>({saved:localStorage.getItem('jobRadarBadgeEnabled'),checked:document.getElementById('badgeBtn').getAttribute('aria-checked'),summary:document.getElementById('badgeSum').textContent,calls:window.__badgeCalls}));
if(enabled.saved!=='1'||enabled.checked!=='true'||!enabled.summary.includes('검토 대기 2건')) throw new Error(`badge enable failed: ${JSON.stringify(enabled)}`);
await page.evaluate(()=>{window.__dbg.state().inbox.pop();window.__dbg.save();});
await page.waitForFunction(()=>window.__badgeCalls.some(x=>x[0]==='set'&&x[1]===1));
await page.evaluate(()=>{window.__dbg.state().inbox=[];window.__dbg.save();});
await page.waitForFunction(()=>window.__badgeCalls.some(x=>x[0]==='clear'));
const final=await page.evaluate(()=>({summary:document.getElementById('badgeSum').textContent,calls:window.__badgeCalls}));
if(!final.summary.includes('검토 대기 0건')) throw new Error(`badge zero summary failed: ${JSON.stringify(final)}`);
if(productionHits) throw new Error(`local badge test contacted production: ${productionHits}`);
console.log(JSON.stringify({exactCounts:[2,1,0],persisted:true,permissionGesture:true,productionFailClosed:true,calls:final.calls},null,2));
await browser.close();
