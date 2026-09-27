import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const MOCK = 'http://127.0.0.1:8877';
const ROOM = 'jr-testroom-000000000000000000000';
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};

async function device(name) {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`[${name}] PE: ` + e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_CONNECTION_RESET|jsdelivr/.test(m.text())) errs.push(`[${name}] C: `+m.text()); });
  p.on('dialog', async d => await d.accept());
  await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.addInitScript(m => { window.__MOCK__ = m; }, MOCK);
  // Supabase URL 을 mock 으로 바꿔치기
  await p.route('**/app.js*', async route => {
    const r = await route.fetch();
    let t = await r.text();
    t = t.replace(/const DEFAULT_SYNC_URL = '[^']*'/, `const DEFAULT_SYNC_URL = '${MOCK}'`);
    await route.fulfill({ response:r, body:t, headers:{...r.headers(), 'content-type':'application/javascript'} });
  });
  await p.addInitScript(() => {
    localStorage.setItem('jobRadarStateV3', JSON.stringify({
      events:[], axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
      profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
        excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
  });
  await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(700);
  return { name, ctx, p };
}
const cfgOf = d => d.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarSyncCfg')||'null'));
const nEv   = d => d.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
const syncTxt = d => d.p.textContent('#syncText');
const addEvent = (d, co) => d.p.evaluate(c => {
  const s = window.__dbg.state();
  s.events.push({id:'e-'+c+'-'+Math.random().toString(36).slice(2,6), company:c, role:'전략기획', tier:'S',
    status:'', date:'2026-10-01', time:'', stage:'apply', kind:'deadline', result:'', hold:false,
    progress:0, english:'', note:'', url:''});
  window.__dbg.save();
}, co);
async function connect(d, room) {
  await d.p.click('.tab[data-tab="more"]'); await d.p.waitForTimeout(200);
  await d.p.click('#syncBtn'); await d.p.waitForTimeout(300);
  await d.p.fill('#sRoom', room);
  await d.p.click('#syncSave'); await d.p.waitForTimeout(1400);
}

await fetch(`${MOCK}/__mode?legacy=0`);
const pc = await device('PC'), ph = await device('PHONE');

// 1) PC 연결 + 첫 push
await addEvent(pc, 'SK하이닉스');
await connect(pc, ROOM);
R['01_PC_baseRev'] = (await cfgOf(pc))?.baseRev;
R['02_PC_dirty'] = (await cfgOf(pc))?.dirty;
R['03_PC_상태'] = await syncTxt(pc);

// 2) 폰 연결 → 받아오기
await connect(ph, ROOM);
await ph.p.waitForTimeout(1200);
R['04_폰_일정'] = await nEv(ph);
R['05_폰_baseRev'] = (await cfgOf(ph))?.baseRev;
R['06_폰_상태'] = await syncTxt(ph);

// 3) 폰에서 수정 → 올림. PC 는 아직 모름
await addEvent(ph, '현대카드');
await ph.p.waitForTimeout(1500);
R['07_폰_rev2'] = (await cfgOf(ph))?.baseRev;

// 4) PC 도 수정 (양쪽 변경) → pull 하면 충돌
await addEvent(pc, 'LG전자');
await pc.p.waitForTimeout(300);
await pc.p.evaluate(() => window.__dbg.pull({silent:false}));
await pc.p.waitForTimeout(1500);
R['08_충돌시트'] = await pc.p.$eval('#cfBg', e => e.classList.contains('open'));
R['09_충돌내용'] = (await pc.p.textContent('#cfBody')).replace(/\s+/g,' ').trim().slice(0,120);
R['10_충돌_상태문구'] = await syncTxt(pc);

// 5) '다른 기기 데이터 사용' → 폰 데이터로 맞춰짐
await pc.p.click('#cfUseRemote'); await pc.p.waitForTimeout(1200);
R['11_PC_일정'] = await nEv(pc);
R['12_PC_회사'] = await pc.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.map(e=>e.company).sort().join(','));
R['13_PC_baseRev'] = (await cfgOf(pc))?.baseRev;
R['14_PC_dirty'] = (await cfgOf(pc))?.dirty;
R['15_되돌리기사본'] = await pc.p.evaluate(() => !!localStorage.getItem('jobRadarRecovery'));

// 6) 다시 양쪽 변경 → 이번엔 '이 기기로 덮어쓰기'
await addEvent(ph, '기아'); await ph.p.waitForTimeout(1400);
await addEvent(pc, '제일기획'); await pc.p.waitForTimeout(300);
await pc.p.evaluate(() => window.__dbg.pull({silent:false})); await pc.p.waitForTimeout(1500);
R['16_두번째충돌'] = await pc.p.$eval('#cfBg', e => e.classList.contains('open'));
await pc.p.click('#cfUseLocal'); await pc.p.waitForTimeout(1500);
R['17_덮어쓴뒤_PC회사'] = await pc.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.map(e=>e.company).sort().join(','));
R['18_덮어쓴뒤_dirty'] = (await cfgOf(pc))?.dirty;
R['19_덮어쓴뒤_상태'] = await syncTxt(pc);
await ph.p.evaluate(() => window.__dbg.pull({silent:true})); await ph.p.waitForTimeout(1200);
R['20_폰이받은회사'] = await ph.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.map(e=>e.company).sort().join(','));

// 7) 같은 기기 안에서 push 중에 또 수정 (localGeneration race)
R['21_연속수정'] = await pc.p.evaluate(async () => {
  const d = window.__dbg;
  d.state().events.push({id:'r1',company:'연속1',role:'x',tier:'A',status:'',date:'2026-11-01',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  d.state().events.push({id:'r2',company:'연속2',role:'x',tier:'A',status:'',date:'2026-11-02',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  d.state().events.push({id:'r3',company:'연속3',role:'x',tier:'A',status:'',date:'2026-11-03',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  await new Promise(r=>setTimeout(r,3000));
  return { dirty: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty,
           rev: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).baseRev };
});
await ph.p.evaluate(() => window.__dbg.pull({silent:true})); await ph.p.waitForTimeout(1200);
R['22_폰이_연속3개받음'] = await ph.p.evaluate(() =>
  ['연속1','연속2','연속3'].every(c => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.some(e=>e.company===c)));

// 8) 구버전 서버 — 첫 저장 / 재-pull / 새 기기 수신까지 전부
await fetch(`${MOCK}/__mode?legacy=1`);
const LROOM = 'jr-legacyroom-00000000000000000';
const lpc = await device('LPC');
await addEvent(lpc, '레거시A');
await connect(lpc, LROOM);
await lpc.p.waitForTimeout(1500);
R['23_구버전_첫저장'] = await syncTxt(lpc);
R['24_구버전_dirty'] = (await cfgOf(lpc))?.dirty;
R['25_구버전_baseRev'] = (await cfgOf(lpc))?.baseRev;
// 저장한 기기가 다시 pull 하면?
await lpc.p.evaluate(() => window.__dbg.pull({silent:true})); await lpc.p.waitForTimeout(1200);
R['26_구버전_재pull'] = await syncTxt(lpc);
R['27_구버전_재pull후_일정'] = await nEv(lpc);
// 새 기기가 처음 붙으면 데이터를 받는가
const lph = await device('LPH');
await connect(lph, LROOM); await lph.p.waitForTimeout(1500);
R['28_구버전_새기기수신'] = await nEv(lph);
R['29_구버전_새기기회사'] = await lph.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.map(e=>e.company).join(','));
// 새 기기에서 수정 → 올리고, 원래 기기가 받는가
await addEvent(lph, '레거시B'); await lph.p.waitForTimeout(1500);
await lpc.p.evaluate(() => window.__dbg.pull({silent:true})); await lpc.p.waitForTimeout(1300);
R['30_구버전_왕복'] = await lpc.p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.map(e=>e.company).sort().join(','));

// 9) push 중 저장 (GPT #3) · 역행 방어 — 새 room 으로 격리해서 검사
await fetch(`${MOCK}/__mode?legacy=0`);
const ROOM2 = 'jr-room2-0000000000000000000000';
const pc2 = await device('PC2'), ph2 = await device('PH2');
await addEvent(pc2, '기준');
await connect(pc2, ROOM2);
await connect(ph2, ROOM2); await ph2.p.waitForTimeout(1000);

R['26_인플라이트저장'] = await pc2.p.evaluate(async () => {
  const d = window.__dbg;
  d.state().events.push({id:'if1',company:'인플라이트A',role:'x',tier:'A',status:'',date:'2026-12-01',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  await new Promise(r=>setTimeout(r,760));           // 디바운스 지나 push 시작
  const pr = d.push({silent:true});
  await new Promise(r=>setTimeout(r,5));
  d.state().events.push({id:'if2',company:'인플라이트B',role:'x',tier:'A',status:'',date:'2026-12-02',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();                                          // push 도중 수정
  await pr;
  const mid = JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty;
  await new Promise(r=>setTimeout(r,2500));
  return { push직후dirty: mid, 최종dirty: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty };
});
await ph2.p.evaluate(() => window.__dbg.pull({silent:true})); await ph2.p.waitForTimeout(1400);
R['27_폰이_B까지받음'] = await ph2.p.evaluate(() =>
  JSON.parse(localStorage.getItem('jobRadarStateV3')).events.some(e=>e.company==='인플라이트B'));

const before = await nEv(pc2);
await pc2.p.evaluate(() => { const c = window.__dbg.cfg(); c.baseRev = 9999; c.dirty = false;
  localStorage.setItem('jobRadarSyncCfg', JSON.stringify(c)); });
await pc2.p.evaluate(() => window.__dbg.pull({silent:true})); await pc2.p.waitForTimeout(1200);
R['28_역행_경고'] = await syncTxt(pc2);
R['29_역행_데이터유지'] = (await nEv(pc2)) === before ? `유지(${before})` : `유실! ${before}→${await nEv(pc2)}`;

// 11) 덮어쓰기 진행 중에 저장 — 그 변경도 이어서 올라가야 한다
await fetch(`${MOCK}/__mode?legacy=0`);
const ROOM3 = 'jr-room3-0000000000000000000000';
const A = await device('A'), B = await device('B');
await addEvent(A, '기준C');
await connect(A, ROOM3);
await connect(B, ROOM3); await B.p.waitForTimeout(1000);
await addEvent(B, 'B가추가'); await B.p.waitForTimeout(1400);      // 서버 rev 올림
await addEvent(A, 'A가추가'); await A.p.waitForTimeout(300);        // A 도 변경 → 충돌 조건
await A.p.evaluate(() => window.__dbg.pull({silent:true})); await A.p.waitForTimeout(1400);
// 배경 동기화에서 난 충돌은 모달을 띄우지 않고 상태줄로만 알린다 (의도된 동작)
R['31a_배경충돌_상태줄'] = await syncTxt(A);
R['31b_모달은안뜸'] = await A.p.$eval('#cfBg', e => !e.classList.contains('open'));
await A.p.click('.tab[data-tab="more"]'); await A.p.waitForTimeout(250);
await A.p.click('#syncBtn'); await A.p.waitForTimeout(500);
R['31c_눌러서열림'] = await A.p.$eval('#cfBg', e => e.classList.contains('open'));

await fetch(`${MOCK}/__delay?ms=1200`);                             // 덮어쓰기 RPC 를 느리게
R['32_덮어쓰는중_저장'] = await A.p.evaluate(async () => {
  document.getElementById('cfUseLocal').click();
  await new Promise(r => setTimeout(r, 250));                       // RPC 진행 중
  const d = window.__dbg;
  d.state().events.push({id:'ov1',company:'덮어쓰는중추가',role:'x',tier:'A',status:'',date:'2026-12-20',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  await new Promise(r => setTimeout(r, 1600));
  const mid = JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty;
  await new Promise(r => setTimeout(r, 3000));                      // 후속 push 가 돌 시간
  return { 덮어쓴직후dirty: mid, 최종dirty: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty };
});
await fetch(`${MOCK}/__delay?ms=0`);
await B.p.evaluate(() => window.__dbg.pull({silent:true})); await B.p.waitForTimeout(1500);
R['33_상대가_덮어쓰는중추가_받음'] = await B.p.evaluate(() =>
  JSON.parse(localStorage.getItem('jobRadarStateV3')).events.some(e => e.company === '덮어쓰는중추가'));

// 12) 동기화 중 비밀키 변경 — 옛 응답이 새 방에 섞이면 안 된다
await fetch(`${MOCK}/__delay?ms=1500`);
R['34_키변경_stale폐기'] = await A.p.evaluate(async () => {
  const d = window.__dbg;
  d.state().events.push({id:'st1',company:'키변경전',role:'x',tier:'A',status:'',date:'2026-12-21',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  d.save();
  const p = d.push({silent:true});                                  // 느린 push 시작
  await new Promise(r => setTimeout(r, 200));
  // 그 사이 사용자가 비밀키를 바꾼다
  document.getElementById('syncBtn').click();
  await new Promise(r => setTimeout(r, 200));
  document.getElementById('sRoom').value = 'jr-room4-0000000000000000000000';
  document.getElementById('syncSave').click();
  await new Promise(r => setTimeout(r, 3500));
  await p.catch(()=>{});
  const c = JSON.parse(localStorage.getItem('jobRadarSyncCfg'));
  return { room: c.room.slice(0,12), baseRev: c.baseRev };
});
await fetch(`${MOCK}/__delay?ms=0`);
R['35_새방_독립'] = await A.p.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('jobRadarSyncCfg'));
  return c.room === 'jr-room4-0000000000000000000000';
});

// 13) 원격은 받았는데 localStorage 저장이 실패하면 — baseRev 를 올리면 안 된다
await fetch(`${MOCK}/__mode?legacy=0`);
const ROOM5 = 'jr-room5-0000000000000000000000';
const S1 = await device('S1'), S2 = await device('S2');
await addEvent(S1, '원본만');
await connect(S1, ROOM5);
await connect(S2, ROOM5); await S2.p.waitForTimeout(1200);
await addEvent(S1, 'S1이추가'); await S1.p.waitForTimeout(1400);   // 서버 rev 2

R['36_저장실패시'] = await S2.p.evaluate(async () => {
  const before = {
    rev: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).baseRev,
    n: JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length
  };
  const orig = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem').value;
  Storage.prototype.setItem = function(k, v) {
    if (k === 'jobRadarStateV3') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    return orig.call(this, k, v);
  };
  await window.__dbg.pull({ silent:true });
  await new Promise(r => setTimeout(r, 400));
  const banner = !document.getElementById('saveErr').hidden;
  const status = document.getElementById('syncText').textContent;
  Storage.prototype.setItem = orig;
  const after = {
    rev: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).baseRev,
    n: JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length,
    메모리일정수: window.__dbg.state().events.length
  };
  return { before, after, banner, status };
});
// 저장이 되는 상태로 돌아오면 다시 받아와야 한다
await S2.p.evaluate(() => window.__dbg.pull({silent:true})); await S2.p.waitForTimeout(1400);
R['37_복구후_수신'] = await S2.p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  const c  = JSON.parse(localStorage.getItem('jobRadarSyncCfg'));
  return { 회사: st.events.map(e=>e.company).sort().join(','), rev: c.baseRev };
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

