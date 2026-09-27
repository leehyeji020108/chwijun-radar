import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
p.on('pageerror', e => errs.push('PE: '+e.message));
p.on('console', m => { if (m.type()==='error' && !/ERR_CONNECTION_RESET|jsdelivr/.test(m.text())) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => {
  const ev = (id,co,stage,date,result,tier) => ({id,company:co,role:'전략기획',tier:tier||'S',status:'',
    date,time:'',stage,kind:'deadline',result:result||'',hold:false,progress:0,english:'',note:'',url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[
      // 종료 대상: 과거 서류(통과) + 미래 검사
      ev('a1','종료대상','apply','2026-08-20','pass'),
      ev('a2','종료대상','test','2026-09-25'),
      // 살아있는 건
      ev('b1','진행중','apply','2026-09-20'),
      // 결과 밀린 건
      ev('c1','결과밀림','apply','2026-08-15','pass'),
      ev('c2','결과밀림','result','2026-09-01')
    ],
    axes:{}, inbox:[], dismissed:[], archived:{}, seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900);
const openDetail = async co => { await p.evaluate(c => [...document.querySelectorAll('.appCard')]
  .find(x => x.querySelector('.acCo')?.textContent.trim()===c).querySelector('.acHit').click(), co);
  await p.waitForTimeout(500); };
const rows = () => p.$$eval('.acCo', n => n.map(x => x.textContent.trim()));

await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(500);
R['01_종료전_목록'] = await rows();
R['02_종료전_퍼널'] = await p.evaluate(async () => { document.querySelector('.tab[data-tab="home"]').click();
  await new Promise(r=>setTimeout(r,300));
  return [...document.querySelectorAll('.fstat')].map(x=>x.querySelector('span').textContent+':'+x.querySelector('b').textContent).join(' '); });
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);

// 종료
await openDetail('종료대상');
R['03_상세_종료버튼'] = (await p.textContent('#apArchive')).trim();
R['04_삭제는숨김'] = await p.$eval('#apMoreMenu', e => e.hidden);
await p.click('#apArchive'); await p.waitForTimeout(700);
R['05_종료후_목록'] = await rows();
R['06_되돌리기바'] = await p.$eval('#undoBar', e => !e.hidden);
R['07_되돌리기문구'] = (await p.textContent('#undoBar')).replace(/\s+/g,' ').trim();
R['08_상태저장'] = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jobRadarStateV3')).archived));

// 홈 / 퍼널 / 다가오는 일정
await p.click('.tab[data-tab="home"]'); await p.waitForTimeout(500);
R['09_퍼널'] = await p.$$eval('.fstat', n => n.map(x=>x.querySelector('span').textContent+':'+x.querySelector('b').textContent).join(' '));
R['10_다가오는일정'] = await p.$$eval('#upcoming .evCo', n => n.map(x=>x.textContent.trim()));
R['11_다음할일'] = (await p.textContent('#nextAction')).includes('종료대상') ? '종료건이뜸(문제)' : '제외됨';

// 캘린더: 과거는 남고 미래는 숨김
await p.click('.tab[data-tab="cal"]'); await p.waitForTimeout(500);
R['12_9월캘린더_종료건'] = await p.evaluate(() =>
  [...document.querySelectorAll('#calendar .cdot')].some(d => (d.title||'').includes('종료대상'))) ? '보임(미래=문제)' : '숨김';
await p.click('#prevMonth'); await p.waitForTimeout(400);
R['13_8월캘린더_과거일정'] = await p.evaluate(() =>
  [...document.querySelectorAll('#calendar .cdot')].some(d => (d.title||'').includes('종료대상'))) ? '남아있음(정상)' : '사라짐(문제)';
await p.click('#nextMonth'); await p.waitForTimeout(300);

// 종료 필터에서만 보인다
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
await p.evaluate(() => [...document.querySelectorAll('[data-pc]')].find(b=>b.dataset.pc==='종료').click());
await p.waitForTimeout(500);
R['14_종료필터_목록'] = await rows();
R['15_종료필터_3번째줄'] = await p.evaluate(() => document.querySelector('.appCard .acMeta').textContent.replace(/\s+/g,' ').trim());
await p.evaluate(() => [...document.querySelectorAll('[data-pc]')].find(b=>b.dataset.pc==='').click());
await p.waitForTimeout(400);

// 종료 취소
await p.evaluate(() => [...document.querySelectorAll('[data-pc]')].find(b=>b.dataset.pc==='종료').click());
await p.waitForTimeout(400);
await openDetail('종료대상');
R['16_취소버튼'] = (await p.textContent('#apArchive')).trim();
R['17_보류버튼숨김'] = await p.$eval('#apHold', e => e.hidden);
await p.click('#apArchive'); await p.waitForTimeout(700);
await p.click('#apClose').catch(()=>{}); await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('[data-pc]')].find(b=>b.dataset.pc==='').click());
await p.waitForTimeout(500);
R['18_취소후_목록'] = await rows();
R['19_취소후_archived'] = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jobRadarStateV3')).archived).length);

// pendingResult 제외
await openDetail('결과밀림');
await p.click('#apArchive'); await p.waitForTimeout(700);
R['20_종료건_결과안물음'] = await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return document.querySelectorAll('.appCard .askRes').length === 0; });

// 완전 삭제 + 되돌리기
await p.evaluate(() => [...document.querySelectorAll('[data-pc]')].find(b=>b.dataset.pc==='종료').click());
await p.waitForTimeout(400);
await openDetail('결과밀림');
await p.click('#apMore'); await p.waitForTimeout(300);
R['21_더보기메뉴열림'] = await p.$eval('#apMoreMenu', e => !e.hidden);
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
await p.click('#apDelete'); await p.waitForTimeout(800);
R['22_삭제됨'] = before + '→' + (await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length));
R['23_되돌리기표시'] = await p.$eval('#undoBar', e => !e.hidden);
await p.click('#undoBtn'); await p.waitForTimeout(700);
R['24_되돌린뒤'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
R['25_archived도복구'] = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jobRadarStateV3')).archived).length);

// 26) ICS — 종료 이후 미래 전형은 내보내지 않는다
R['26_ICS'] = await p.evaluate(() => {
  const d = window.__dbg;
  const before = d.ics();
  d.archive('진행중|전략기획', true);
  const after = d.ics();
  d.archive('진행중|전략기획', false);
  return { 종료전: before.count, 종료후: after.count,
           진행중포함: before.text.includes('진행중'), 종료후포함: after.text.includes('진행중') };
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

