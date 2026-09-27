import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PE: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_CONNECTION_RESET')) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));

const ev = (id, co, stage, date, result='') => ({id, company:co, role:'전략기획', tier:'S', status:'',
  date, time:'', stage, kind:'deadline', result, hold:false, progress:0, english:'', note:'', url:''});

await p.addInitScript(() => {
  if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s','1');
  const ev = (id, co, stage, date, result='') => ({id, company:co, role:'전략기획', tier:'S', status:'',
    date, time:'', stage, kind:'deadline', result, hold:false, progress:0, english:'', note:'', url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[
      // 마감 지남 + 제출 여부 입력 없음  → 지원예정 이어야 한다
      ev('a1','과거마감','apply','2026-08-20'),
      // 서류발표일 지남 + 합불 입력 없음 → 지원예정 이어야 한다 (서류합격 아님)
      ev('b1','발표지남','apply','2026-08-20'), ev('b2','발표지남','result','2026-09-01'),
      // 검사일 지남 + 결과 없음 → 지원예정 이어야 한다
      ev('c1','검사지남','apply','2026-08-20'), ev('c2','검사지남','test','2026-09-02'),
      // 제출 완료만 입력 → 지원완료
      ev('d1','제출함','apply','2026-08-20','submitted'),
      // 서류 통과 입력 → 서류합격
      ev('e1','서류통과','apply','2026-08-20','pass'),
      // 서류 통과 + 검사 일정 있음 → 검사·면접
      ev('f1','검사예정','apply','2026-08-20','pass'), ev('f2','검사예정','test','2026-09-25'),
      // 발표에서 탈락 입력 → 불합격
      ev('g1','탈락','apply','2026-08-20','pass'), ev('g2','탈락','result','2026-09-01','fail')
    ],
    axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(500);

const stat = async co => await p.evaluate(c => {
  const r = [...document.querySelectorAll('.appCard')].find(x => (x.querySelector('.acCo')||{}).textContent?.trim().startsWith(c));
  return r ? r.querySelector('.acMeta').textContent.replace(/\s+/g,' ').trim().split(' ·')[0] : 'none'; }, co);

R['01_마감지남_입력없음'] = await stat('과거마감');
R['02_발표지남_입력없음'] = await stat('발표지남');
R['03_검사지남_입력없음'] = await stat('검사지남');
R['04_제출입력'] = await stat('제출함');
R['05_서류통과'] = await stat('서류통과');
R['06_서류통과+검사예정'] = await stat('검사예정');
R['07_탈락입력'] = await stat('탈락');

// 결과 입력 요청 문구가 단계별로 다른가
const ask = async co => await p.evaluate(c => {
  const r = [...document.querySelectorAll('.appCard')].find(x => (x.querySelector('.acCo')||{}).textContent?.trim().startsWith(c));
  const a = r && r.querySelector('.askRes'); return a ? a.textContent.replace(/\s+/g,' ').trim() : 'none'; }, co);
R['08_마감문구'] = await ask('과거마감');
R['09_발표문구'] = await ask('발표지남');
R['10_검사문구'] = await ask('검사지남');

// 발표 이벤트에서 통과/탈락을 직접 고를 수 있는가
R['11_발표결과옵션'] = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.appCard')].find(x => (x.querySelector('.acCo')||{}).textContent?.trim().startsWith('발표지남'));
  return [...r.querySelectorAll('.askRes .resBtn')].map(b => b.textContent).join('/'); });
await p.evaluate(() => { const r = [...document.querySelectorAll('.appCard')].find(x => (x.querySelector('.acCo')||{}).textContent?.trim().startsWith('발표지남'));
  r.querySelector('[data-val="pass"]').click(); });
await p.waitForTimeout(900);
const modal = await p.$eval('#modalBg', e => e.classList.contains('open'));
if (modal) { await p.click('#cancelBtn'); await p.waitForTimeout(400); }
R['12_발표통과후'] = await stat('발표지남');

// 홈 퍼널이 거짓말을 안 하는가
await p.click('.tab[data-tab="home"]'); await p.waitForTimeout(400);
R['13_퍼널'] = await p.$$eval('.fstat', n => n.map(x => x.querySelector('span').textContent+':'+x.querySelector('b').textContent).join(' '));

// ── handoff 가 이전 사용자 사본을 남기는가 ──
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
await p.evaluate(() => { const d = document.getElementById('dangerZone'); if (d) d.open = true; });
await p.click('#wipeBtn'); await p.waitForTimeout(700);
R['14_지우기후사본'] = await p.evaluate(() => !!localStorage.getItem('jobRadarRecovery'));
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(900);
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
R['15_되돌리기보임'] = await p.$eval('#recoverBtn', e => !e.hidden);
await p.evaluate(() => { const d = document.getElementById('dangerZone'); if (d) d.open = true; });
await p.click('#handoffBtn'); await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(2500);
R['16_넘긴뒤사본없음'] = await p.evaluate(() => localStorage.getItem('jobRadarRecovery') === null);
R['17_넘긴뒤저장소'] = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('jobRadar')).join(',') || 'none-or-fresh');
R['18_넘긴뒤온보딩'] = await p.$eval('#onboard', e => !e.hidden);
await p.evaluate(() => { const s=JSON.parse(localStorage.getItem('jobRadarStateV3')); s.profile.done=true;
  localStorage.setItem('jobRadarStateV3', JSON.stringify(s)); });
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(900);
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(400);
R['19_되돌리기숨김'] = await p.$eval('#recoverBtn', e => e.hidden);
R['20_이전데이터없음'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

