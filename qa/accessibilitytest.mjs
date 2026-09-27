import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');
const browser=await chromium.launch({
  executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const BASE=process.env.RADAR_BASE_URL||'http://127.0.0.1:8899/';
let productionWrites=0;
await context.route('https://qxejfgbrszcnejkrgiwu.supabase.co/**',route=>{
  if(route.request().method()!=='GET'){
    productionWrites++;
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_items**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await context.route('http://127.0.0.1:8878/rest/v1/radar_feed_status**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{status:'ok',completed_at:'2026-09-14T00:00:00Z',candidate_count:0,checked_company_count:50}])}));
const page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('jobRadarStateV3',JSON.stringify({
  events:[],axes:{},inbox:[],dismissed:[],archived:{},qualifications:[],outProposals:[],ignoredOut:{},radarSeen:{},radarIdentity:{},seedVersion:2,resultVersion:1,updatedAt:Date.now(),
  profile:{done:true,pdb:false,name:'접근성QA',jobs:['R&D·연구개발'],axisOrder:[],criteria:{},excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:Date.now()}
})));
await page.goto(BASE,{waitUntil:'domcontentloaded'});

const initial=await page.evaluate(()=>({
  closedDialogs:[...document.querySelectorAll('.scrim')].every(x=>x.inert&&x.getAttribute('aria-hidden')==='true'),
  dialogRoles:[...document.querySelectorAll('.scrim .sheet')].every(x=>x.getAttribute('role')==='dialog'&&x.getAttribute('aria-modal')==='true'&&x.getAttribute('aria-labelledby')),
  currentTab:document.querySelector('.tab[aria-current="page"]')?.dataset.tab,
  liveRegions:['toast','inboxAlert','radarStatus'].every(id=>document.getElementById(id)?.getAttribute('aria-live')==='polite')
}));
if(!initial.closedDialogs||!initial.dialogRoles||initial.currentTab!=='home'||!initial.liveRegions) throw new Error(`initial accessibility semantics failed: ${JSON.stringify(initial)}`);

await page.click('.tab[data-tab="apps"]');
await page.click('#addBtn');
await page.waitForTimeout(80);
const opened=await page.evaluate(()=>({
  open:document.getElementById('modalBg').classList.contains('open'),
  inert:document.getElementById('modalBg').inert,
  hidden:document.getElementById('modalBg').getAttribute('aria-hidden'),
  focus:document.activeElement?.id,
  currentTab:document.querySelector('.tab[aria-current="page"]')?.dataset.tab
}));
if(!opened.open||opened.inert||opened.hidden!=='false'||opened.focus!=='cancelBtn'||opened.currentTab!=='apps') throw new Error(`dialog open/focus failed: ${JSON.stringify(opened)}`);

await page.keyboard.press('Escape');
await page.waitForTimeout(80);
const closed=await page.evaluate(()=>({
  open:document.getElementById('modalBg').classList.contains('open'),
  inert:document.getElementById('modalBg').inert,
  hidden:document.getElementById('modalBg').getAttribute('aria-hidden'),
  focus:document.activeElement?.id
}));
if(closed.open||!closed.inert||closed.hidden!=='true'||closed.focus!=='addBtn') throw new Error(`dialog close/focus restore failed: ${JSON.stringify(closed)}`);

const visual=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement);
  const rgb=s=>s.match(/\d+/g).slice(0,3).map(Number);
  const lum=c=>{const v=rgb(c).map(x=>x/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  const white='rgb(255, 255, 255)', bg='rgb(242, 244, 246)';
  const ink3=root.getPropertyValue('--ink-3').trim(), ink4=root.getPropertyValue('--ink-4').trim();
  const ctx=document.createElement('canvas').getContext('2d');
  const asRgb=x=>{ctx.fillStyle=x;return ctx.fillStyle.startsWith('#')?`rgb(${parseInt(ctx.fillStyle.slice(1,3),16)}, ${parseInt(ctx.fillStyle.slice(3,5),16)}, ${parseInt(ctx.fillStyle.slice(5,7),16)})`:ctx.fillStyle};
  return {ink3White:ratio(asRgb(ink3),white),ink4White:ratio(asRgb(ink4),white),ink4Bg:ratio(asRgb(ink4),bg)};
});
if(Math.min(visual.ink3White,visual.ink4White,visual.ink4Bg)<4.5) throw new Error(`contrast failed: ${JSON.stringify(visual)}`);
if(productionWrites) throw new Error(`production write attempted: ${productionWrites}`);

console.log(JSON.stringify({initial,opened,closed,visual,productionWrites},null,2));
await browser.close();
