import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PE: '+e.message));
p.on('console', m => { if (m.type()==='error' && !/jsdelivr|CONNECTION/.test(m.text())) errs.push('C: '+m.text()); });
await p.route('**cdn.jsdelivr.net**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
const ev = (id,co,role,stage,date) => ({id,company:co,role,tier:'S',status:'',
  date,time:'',stage,kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
await p.addInitScript(() => {
  const ev = (id,co,role,stage,date) => ({id,company:co,role,tier:'S',status:'',
    date,time:'',stage,kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[ ev('a','현대카드','카드상품기획','apply','2026-09-25'),
             ev('b','제일기획','마케팅전략','apply','2026-09-26'),
             ev('c','SK하이닉스','영업/마케팅/상품기획/신제품사업화','apply','2026-09-27') ],
    axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[],
    seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'준기',grad:'',major:'',jobs:['전략기획'],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'옛날프롬프트',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1000);
const R = {};

/* ── 프롬프트가 저장본이 아니라 state 에서 나오는가 ── */
R['01_저장된프롬프트_버려짐'] = await p.evaluate(() =>
  JSON.parse(localStorage.getItem('jobRadarStateV3')).profile.prompt === '');
R['02_프롬프트에_현재지원3건'] = await p.evaluate(() => {
  const t = window.__dbg.myPrompt();
  return ['현대카드','제일기획','SK하이닉스'].every(c => t.includes(c));
});
R['03_어학없으면_추측금지문구'] = await p.evaluate(() =>
  window.__dbg.myPrompt().includes('내 점수를 추측하지 마라'));

/* 어학을 넣으면 프롬프트가 그 자리에서 바뀐다 */
R['04_어학추가시_프롬프트반영'] = await p.evaluate(() => {
  window.__dbg.quals().push({ id:'q1', type:'TOEIC Speaking', score:null, grade:null,
    testDate:'2026-09-09', resultDate:'2026-09-12', validUntil:'' });
  window.__dbg.save();
  const t = window.__dbg.myPrompt();
  return { 결과대기표시: t.includes('결과 발표 전'), 발표일: t.includes('2026-09-12'),
           미달금지: t.includes('«미달» 이라고 판단하는 것을 금지') };
});

/* ── out 제안: 붙여넣어도 «자동으로» 바뀌지 않는다 ── */
const PATCH = JSON.stringify({
  items: [],
  out: [ { company:'현대카드', role:'카드상품기획', reason:'이번 시즌 제외 결정' },
         { company:'제일기획', role:'마케팅전략', reason:'제외' },
         { company:'없는회사', role:'없음', reason:'존재하지 않음' } ],
  checks: []
});
await p.evaluate(t => { document.getElementById('importBtn').click();
  document.getElementById('impBox').value = t;
  document.getElementById('impRun').click(); }, PATCH);
await p.waitForTimeout(700);
R['05_제안만쌓임_데이터는그대로'] = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { 제안: st.outProposals.length, 실제종료: Object.keys(st.archived).length,
           일정수: st.events.length };
});
R['06_없는회사는_무시하고알림'] = await p.evaluate(() =>
  document.getElementById('impResult').textContent.includes('지원 목록에 없는 회사를 1건'));

await p.evaluate(() => { const s=document.getElementById('impBg'); if(s) s.classList.remove('open'); });
await p.click('.tab[data-tab="inbox"]'); await p.waitForTimeout(500);
R['07_제안이_화면에보임'] = await p.evaluate(() => ({
  행수: document.querySelectorAll('.opRow').length,
  문구: (document.querySelector('.opHead span')||{}).textContent || '' }));

/* 하나만 승인 */
await p.evaluate(() => document.querySelector('[data-opok="0"]').click());
await p.waitForTimeout(500);
R['08_하나승인'] = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { archived: Object.keys(st.archived), 남은제안: st.outProposals.length };
});
R['09_되돌리기있음'] = await p.evaluate(() => !document.getElementById('undoBar').hidden);
await p.evaluate(() => document.getElementById('undoBtn').click());
await p.waitForTimeout(500);
R['10_되돌리면_복구'] = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { archived: Object.keys(st.archived).length, 제안: st.outProposals.length };
});

/* 종료하면 프롬프트의 «진행 중» 에서 빠지고 «추천 금지» 로 간다 */
await p.evaluate(() => {
  const i = [...document.querySelectorAll('.opCo')].findIndex(x => x.textContent.trim() === '현대카드');
  document.querySelector(`[data-opok="${i}"]`).click();
});
await p.waitForTimeout(400);
R['11_종료후_프롬프트'] = await p.evaluate(() => {
  const t = window.__dbg.myPrompt();
  const live = t.slice(t.indexOf('[지금 진행 중인 지원'), t.indexOf('[더 이상 추천하지 말 것]'));
  const out  = t.slice(t.indexOf('[더 이상 추천하지 말 것]'), t.indexOf('[확인 요청'));
  return { 진행중에_현대카드: live.includes('현대카드'), 금지목록에_현대카드: out.includes('현대카드') };
});

/* 무시 버튼 */
await p.evaluate(() => { const b=document.querySelector('[data-opskip]'); if(b) b.click(); });
await p.waitForTimeout(400);
R['12_무시하면_제안만사라짐'] = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { 제안: st.outProposals.length, archived: Object.keys(st.archived).length };
});

/* 어학 성적도 붙여넣기로 들어오는가 (점수는 비운 채로) */
await p.evaluate(() => { document.getElementById('importBtn').click();
  document.getElementById('impBox').value = JSON.stringify({ items:[], out:[], checks:[],
    qualifications:[{ type:'TOEIC Speaking', score:null, grade:null,
      testDate:'2026-09-09', resultDate:'2026-09-12', validUntil:'' }] });
  document.getElementById('impRun').click(); });
await p.waitForTimeout(700);
R['13_어학_붙여넣기'] = await p.evaluate(() => {
  const q = JSON.parse(localStorage.getItem('jobRadarStateV3')).qualifications;
  const mine = q.filter(x => x.type === 'TOEIC Speaking' && x.testDate === '2026-09-09');
  return { 건수: mine.length, grade: mine[0] && mine[0].grade, score: mine[0] && mine[0].score,
           status: window.__dbg.qualStatus(mine[0]) };
});
R['14_같은시험_재붙여넣기는_갱신'] = await p.evaluate(() => {
  const before = window.__dbg.quals().filter(x => x.testDate === '2026-09-09').length;
  document.getElementById('impBox').value = JSON.stringify({ qualifications:[
    { type:'TOEIC Speaking', grade:'IM3', testDate:'2026-09-09', resultDate:'2026-09-12' }] });
  document.getElementById('impRun').click();
  return new Promise(r => setTimeout(() => {
    const q = window.__dbg.quals().filter(x => x.testDate === '2026-09-09');
    r({ 중복안생김: q.length === before, grade: q[0].grade,
        판정: window.__dbg.evalElig('TOEIC Speaking AL 이상').label });
  }, 400));
});

/* ══ 무시는 «영구 삭제» 도 «매번 재질문» 도 아니다 ══ */
const OUT_HYUNDAI = JSON.stringify({ out:[{company:'현대카드', role:'카드상품기획', reason:'제외'}] });
const imp = t => p.evaluate(x => { document.getElementById('importBtn').click();
  document.getElementById('impBox').value = x;
  document.getElementById('impRun').click(); }, t);

// 상태를 깨끗이 되돌린 뒤 시작
await p.evaluate(() => {
  const st = window.__dbg.state();
  st.archived = {}; st.outProposals = []; st.ignoredOut = {};
  st.events.push({id:'a2',company:'현대카드',role:'카드상품기획',tier:'S',status:'',
    date:'2026-09-25',time:'',stage:'apply',kind:'deadline',result:'',hold:false,
    progress:0,english:'TOEIC 900 이상',note:'',url:''});
  window.__dbg.save();
});
await imp(OUT_HYUNDAI); await p.waitForTimeout(600);
await p.click('.tab[data-tab="inbox"]'); await p.waitForTimeout(400);
R['15_무시_기록됨'] = await p.evaluate(async () => {
  const i = [...document.querySelectorAll('.opCo')].findIndex(x => x.textContent.trim() === '현대카드');
  document.querySelector(`[data-opskip="${i}"]`).click();
  await new Promise(r => setTimeout(r, 400));
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  const k = Object.keys(st.ignoredOut)[0];
  return { key: k, basis: st.ignoredOut[k].basis, 제안: st.outProposals.length,
           archived: Object.keys(st.archived).length };
});

// 같은 근거로 또 오면 조용히 숨긴다
await imp(OUT_HYUNDAI); await p.waitForTimeout(600);
R['16_같은근거면_안뜸'] = await p.evaluate(() => ({
  제안: JSON.parse(localStorage.getItem('jobRadarStateV3')).outProposals.length,
  안내: document.getElementById('impResult').textContent.includes('전에 무시한 종료 제안 1건') }));

// 어학 결과가 나오면 근거가 바뀐다 → 다시 물어야 한다
R['17_어학결과나오면_다시뜸'] = await p.evaluate(async () => {
  window.__dbg.quals().push({ id:'q9', type:'TOEIC', score:950, grade:null,
    testDate:'2026-08-01', resultDate:'2026-08-10', validUntil:'2028-08-01' });
  window.__dbg.save();
  document.getElementById('impBox').value = JSON.stringify({
    out:[{company:'현대카드', role:'카드상품기획', reason:'제외'}] });
  document.getElementById('impRun').click();
  await new Promise(r => setTimeout(r, 500));
  return JSON.parse(localStorage.getItem('jobRadarStateV3')).outProposals.length;
});

// 다시 무시하면 새 근거로 기록되고, 그 뒤 지원 상태가 바뀌면 또 물어야 한다
R['18_상태바뀌면_다시뜸'] = await p.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = () => { document.getElementById('impBox').value = JSON.stringify({
    out:[{company:'현대카드', role:'카드상품기획', reason:'제외'}] });
    document.getElementById('impRun').click(); };
  // 새 근거로 다시 무시
  const i = [...document.querySelectorAll('.opCo')].findIndex(x => x.textContent.trim() === '현대카드');
  document.querySelector(`[data-opskip="${i}"]`).click();
  await wait(400);
  const basis1 = Object.values(window.__dbg.state().ignoredOut)[0].basis;
  run(); await wait(450);
  const 근거같을때 = window.__dbg.state().outProposals.length;      // 0 이어야 한다
  // 지원 상태를 바꾼다 → 근거가 달라진다
  // 이 그룹의 첫 apply 건에 결과를 넣는다 (deriveStatus 가 보는 건 그거다)
  window.__dbg.state().events.filter(e => e.company === '현대카드')
    .forEach(e => { if (e.stage === 'apply') e.result = 'submitted'; });
  window.__dbg.save();
  run(); await wait(450);
  const g = window.__dbg.state();
  const ev = g.events.find(e => e.id === 'a2');
  return { basis1, 근거같을때, 상태바뀐뒤: g.outProposals.length,
           _basis2: Object.values(g.ignoredOut).map(x => x.basis).join(',') };
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length?errs:'none');
await b.close();

