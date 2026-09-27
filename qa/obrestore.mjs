import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const MOCK = 'http://127.0.0.1:8877';
await fetch(`${MOCK}/__mode?legacy=0`);
// 서비스워커가 app.js 를 캐시에서 내주면 mock 치환이 안 먹는다 → 테스트에서는 SW 차단
const c = await b.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
await c.route('**cdn.jsdelivr.net**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
// Supabase URL 을 mock 으로 바꿔치기 (synctest 와 같은 방식)
await c.route('**/app.js*', async route => {
  const r = await route.fetch(); let t = await r.text();
  t = t.replace(/const DEFAULT_SYNC_URL = '[^']*'/, `const DEFAULT_SYNC_URL = '${MOCK}'`);
  await route.fulfill({ response:r, body:t, headers:{...r.headers(), 'content-type':'application/javascript'} });
});
const p = await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PE: '+e.message));
p.on('console', m => { if (m.type()==='error' && !/jsdelivr|CONNECTION|404/.test(m.text())) errs.push('C: '+m.text()); });
const ROOM = 'jr-restore-0000000000000';
const R = {};

/* ── 기기 A: 데이터 만들고 동기화 올리기 ── */
await p.addInitScript(([room]) => {
  const ev = (id,co,role,stage,date) => ({id,company:co,role,tier:'S',status:'',
    date,time:'',stage,kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[ ev('a','롯데칠성음료','영업기획','apply','2026-09-25'),
             ev('b','기아','SDV 전략기획','apply','2026-09-26') ],
    axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{},
    seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'준기',grad:'2025-02',major:'사회환경공학부',
      jobs:['전략기획','사업기획'],axisOrder:[],criteria:{},excludeCompanies:['APR'],
      excludeRoles:[],strength:'창업',want:'',avoid:'',prompt:'',createdAt:1}}));
  localStorage.setItem('jobRadarSyncCfg', JSON.stringify({
    url:'http://127.0.0.1:8877', key:'anon', room, baseRev:0, dirty:true, deviceId:'d-A' }));
}, [ROOM]);
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1200);
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(250);
await p.click('#syncBtn'); await p.waitForTimeout(350);
await p.fill('#sRoom', ROOM);
await p.click('#syncSave'); await p.waitForTimeout(1800);
R['01_A_올림'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarSyncCfg')).baseRev);

/* ── 기기 B: 완전히 새 기기 ── */
const p2 = await c.newPage();
p2.on('pageerror', e => errs.push('PE2: '+e.message));
await p2.addInitScript(() => { localStorage.clear(); });
await p2.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p2.waitForTimeout(1200);
R['02_온보딩뜸'] = await p2.evaluate(() => !document.getElementById('onboard').hidden);
R['03_불러오기버튼_보임'] = await p2.evaluate(() => {
  const b = document.getElementById('obRestore');
  return b ? b.textContent.trim() : '없음';
});
R['04_제목'] = await p2.evaluate(() => document.querySelector('.obTitle').textContent.trim());

await p2.evaluate(() => document.getElementById('obRestore').click());
await p2.waitForTimeout(500);
R['05_시트가_온보딩위'] = await p2.evaluate(() => {
  const sc = document.getElementById('syncBg'), ob = document.getElementById('onboard');
  return { 시트열림: sc.classList.contains('open'), 온보딩살아있음: !ob.hidden,
           시트가위: +getComputedStyle(sc).zIndex > +getComputedStyle(ob).zIndex };
});

await p2.fill('#sRoom', ROOM);
await p2.click('#syncSave');
await p2.waitForTimeout(2500);
R['05b_디버그'] = await p2.evaluate(() => ({
  syncText: (document.getElementById('syncText')||{}).textContent || '',
  cfg: localStorage.getItem('jobRadarSyncCfg'),
  restoring: typeof window.__dbg !== 'undefined' ? 'dbg있음' : 'dbg없음',
  toast: (document.getElementById('toast')||{}).textContent || '' }));
R['06_복원됨'] = await p2.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3') || '{}');
  return { 온보딩닫힘: document.getElementById('onboard').hidden,
           이름: st.profile && st.profile.name, 직무: st.profile && st.profile.jobs,
           제외회사: st.profile && st.profile.excludeCompanies,
           일정수: (st.events||[]).length,
           회사: (st.events||[]).map(e=>e.company).sort().join(',') };
});
R['07_홈에_데이터'] = await p2.evaluate(() =>
  document.getElementById('nextAction').textContent.replace(/\s+/g,' ').trim().slice(0,40));

/* ── 잘못된 키로 복원 시도하면 갇히지 않아야 한다 ── */
const p3 = await c.newPage();
p3.on('pageerror', e => errs.push('PE3: '+e.message));
await p3.addInitScript(() => { localStorage.clear(); });
await p3.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p3.waitForTimeout(1200);
await p3.evaluate(() => document.getElementById('obRestore').click());
await p3.waitForTimeout(400);
await p3.fill('#sRoom', 'jr-nothing-here-000000000');
await p3.click('#syncSave');
await p3.waitForTimeout(2500);
R['08_빈키면_안갇힘'] = await p3.evaluate(() => ({
  온보딩그대로: !document.getElementById('onboard').hidden,
  안내: (document.getElementById('toast')||{}).textContent || '' }));

/* ── 신규 사용자: 설문은 끝났고 지원 건은 0 ── */
const p4 = await c.newPage();
p4.on('pageerror', e => errs.push('PE4: '+e.message));
await p4.addInitScript(() => {
  localStorage.removeItem('jobRadarSyncCfg');
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[], axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[],
    outProposals:[], ignoredOut:{}, seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'새사람',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:1}}));
});
await p4.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p4.waitForTimeout(1400);
R['09_온보딩_안뜸'] = await p4.evaluate(() => document.getElementById('onboard').hidden);
R['10_EmptyState_액션'] = await p4.evaluate(() => ({
  제목: (document.querySelector('#nextAction .empty b')||{}).textContent || '',
  설명: (document.querySelector('#nextAction .empty span')||{}).textContent || '',
  버튼: [...document.querySelectorAll('#nextAction .empty button')].map(b=>b.textContent.trim()),
  홈에_동기화블록: !!document.getElementById('syncCfgBtn'),
  동기화배너숨김: document.getElementById('syncBar').hidden }));
R['11_공고가져오기_열림'] = await p4.evaluate(async () => {
  document.getElementById('emptyImport').click();
  await new Promise(r=>setTimeout(r,350));
  return document.getElementById('impBg').classList.contains('open');
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length?errs:'none');
await b.close();

