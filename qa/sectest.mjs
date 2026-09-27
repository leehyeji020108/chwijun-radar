import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PE: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_CONNECTION_RESET')) errs.push('C: '+m.text()); });
let dialogs = [];
p.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => {
  if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s','1');
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[{id:'e1',company:'악성',role:'테스트',tier:'S',status:'',date:'2026-09-20',time:'',stage:'apply',kind:'deadline',
             result:'',hold:false,progress:0,english:'',note:'',url:'javascript:alert(1)'},
            {id:'e2',company:'정상',role:'테스트',tier:'S',status:'',date:'2026-09-21',time:'',stage:'apply',kind:'deadline',
             result:'',hold:false,progress:0,english:'',note:'',url:'https://example.com/a'}],
    axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);

// #43 javascript: URL 차단
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
R['01_js링크제거'] = await p.evaluate(() =>
  ![...document.querySelectorAll('a.golink')].some(a => (a.getAttribute('href')||'').startsWith('javascript')));
R['02_정상링크유지'] = await p.evaluate(() =>
  [...document.querySelectorAll('a.golink')].some(a => (a.getAttribute('href')||'').startsWith('https://example.com')));

// #43 가져오기로 들어온 javascript: 도 막히는가
await p.click('.tab[data-tab="more"]'); await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify([{company:'주입',role:'x',tier:'A',url:'javascript:alert(2)',
  schedule:[{stage:'apply',date:'2026-10-01',time:''}]}]));
await p.click('#impRun'); await p.waitForTimeout(900);
R['03_가져오기js차단'] = await p.evaluate(() => {
  const ib = JSON.parse(localStorage.getItem('jobRadarStateV3')).inbox;
  return ib.length === 1 && ib[0].url === '' && ib[0].unverified === true; });

// #46 저장 실패를 드러내는가 (persist 만 실패시켰다가 원복)
R['04_배너표시'] = await p.evaluate(() => {
  const orig = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem').value;
  Storage.prototype.setItem = function(){ const e=new Error('full'); e.name='QuotaExceededError'; throw e; };
  window.__dbg.persist();
  const shown = !document.getElementById('saveErr').hidden;
  const txt = document.getElementById('saveErr').textContent;
  Storage.prototype.setItem = orig;
  window.__dbg.persist();
  return shown + ' / 문구:' + txt.includes('저장 공간') + ' / 복구후숨김:' + document.getElementById('saveErr').hidden;
});

// #45 백업 복원 확인창
R['06_복원확인창'] = 'skip(파일입력)';

// #44 체크포인트 + 되돌리기
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
R['07_되돌리기숨김'] = await p.$eval('#recoverBtn', e => e.hidden);
dialogs = [];
await p.evaluate(() => { const d = document.getElementById('dangerZone'); if (d) d.open = true; });
await p.click('#wipeBtn'); await p.waitForTimeout(800);
R['08_지운뒤일정'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
R['09_사본생김'] = await p.evaluate(() => !!localStorage.getItem('jobRadarRecovery'));
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(900);
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(400);
R['10_되돌리기노출'] = await p.$eval('#recoverBtn', e => !e.hidden);
R['11_되돌리기설명'] = (await p.textContent('#recoverBtn .rowS')).includes('일정 2건');
await p.click('#recoverBtn'); await p.waitForTimeout(900);
R['12_복구됨'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

