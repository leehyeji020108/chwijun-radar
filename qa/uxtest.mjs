import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PE: '+e.message));
p.on('console', m => { if (m.type()==='error' && !/jsdelivr|CONNECTION|404/.test(m.text())) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => {
  const ev = (id,co,role,stage,date,eng,res,note) => ({id,company:co,role,tier:'S',status:'',
    date,time:'',stage,kind:'deadline',result:res||'',hold:false,progress:0,english:eng||'',note:note||'',url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[ ev('a','현대자동차','미래사업전략','apply','2026-09-25','TOEIC Speaking AL 이상','submitted','서류 메모'),
             ev('a2','현대자동차','미래사업전략','test','2026-10-05','','pass','검사 메모'),
             ev('b','기아','SDV 전략기획','apply','2026-09-26','', 'submitted') ],
    axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[],
    outProposals:[{ key:'현대자동차|미래사업전략', company:'현대자동차', role:'미래사업전략',
      reason:'제외 검토', at:Date.now() }],
    ignoredOut:{ '현대자동차|미래사업전략': { basis:'x', at:Date.now() } },
    seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'준기',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1000);
const R = {};
const openDetail = async co => { await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
  await p.evaluate(c => [...document.querySelectorAll('.appCard')]
    .find(x => x.querySelector('.acCo').textContent.trim()===c).querySelector('.acHit').click(), co);
  await p.waitForTimeout(400); };

/* ── ① 어학 입력 → 새로고침 없이 전체 재계산 ── */
await openDetail('현대자동차');
R['01_입력전_판정'] = await p.textContent('#apBody .egBadge').catch(()=>'없음');
await p.evaluate(() => document.getElementById('apClose').click()); await p.waitForTimeout(300);
R['02_어학입력_즉시반영'] = await p.evaluate(async () => {
  document.querySelector('.tab[data-tab="more"]').click();
  await new Promise(r=>setTimeout(r,250));
  document.getElementById('qualBtn').click();
  await new Promise(r=>setTimeout(r,250));
  document.getElementById('qualAdd').click();
  await new Promise(r=>setTimeout(r,250));
  const g = document.querySelector('[data-f="grade"]');
  g.value = 'AL'; g.dispatchEvent(new Event('change', {bubbles:true}));
  await new Promise(r=>setTimeout(r,350));
  return { 저장됨: JSON.parse(localStorage.getItem('jobRadarStateV3')).qualifications[0].grade,
           dirty: JSON.parse(localStorage.getItem('jobRadarSyncCfg') || '{}').dirty,
           판정: window.__dbg.evalElig('TOEIC Speaking AL 이상').label,
           프롬프트반영: window.__dbg.myPrompt().includes('TOEIC Speaking: AL') };
});
await p.evaluate(() => document.getElementById('qualClose').click()); await p.waitForTimeout(300);
await openDetail('현대자동차');
R['03_새로고침없이_배지갱신'] = await p.textContent('#apBody .egBadge');

/* ── ② 직무 수정 — 이력·파생참조 보존 ── */
R['04_수정버튼_보임'] = await p.evaluate(() => !!document.getElementById('apEdit'));
await p.evaluate(() => {
  window.__dbg.state().archived['현대자동차|미래사업전략'] = {at:Date.now()};
  window.__dbg.save();
});
await p.evaluate(() => document.getElementById('apEdit').click()); await p.waitForTimeout(400);
R['05_수정_저장'] = await p.evaluate(async () => {
  document.getElementById('edRole').value = '경영전략';
  document.getElementById('edSave').click();
  await new Promise(r=>setTimeout(r,500));
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  const mine = st.events.filter(e => e.company === '현대자동차');
  return { 일정수: mine.length, 직무: [...new Set(mine.map(e=>e.role))],
           결과보존: mine.map(e=>e.result).join(','),
           메모보존: mine.map(e=>e.note).join(','),
           지원건수: new Set(st.events.map(e=>e.company+'|'+e.role)).size,
           archive키: Object.keys(st.archived),
           ignoredOut키: Object.keys(st.ignoredOut),
           제안: st.outProposals.map(o=>({key:o.key, role:o.role})) };
});
R['06_중복지원건_안생김'] = await p.evaluate(() => {
    const st = window.__dbg.state();
    return new Set(st.events.filter(e=>e.company==='현대자동차').map(e=>e.company+'|'+e.role)).size;
  });
R['07_되돌리기'] = await p.evaluate(async () => {
  document.getElementById('undoBtn').click();
  await new Promise(r=>setTimeout(r,500));
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { 직무: [...new Set(st.events.filter(e=>e.company==='현대자동차').map(e=>e.role))],
           archive키: Object.keys(st.archived), ignoredOut키: Object.keys(st.ignoredOut),
           제안: st.outProposals.map(o=>({key:o.key, role:o.role})) };
});

/* 동일 company+role이 이미 있으면 수정 전체를 차단하고 원상을 보존한다. */
await p.evaluate(() => document.getElementById('apEdit').click()); await p.waitForTimeout(250);
R['07b_중복수정_차단'] = await p.evaluate(async () => {
  document.getElementById('edCompany').value = '기아';
  document.getElementById('edRole').value = 'SDV 전략기획';
  document.getElementById('edSave').click();
  await new Promise(r=>setTimeout(r,250));
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { 경고: document.getElementById('edWarn').textContent,
    현대차직무:[...new Set(st.events.filter(e=>e.company==='현대자동차').map(e=>e.role))],
    기아일정수:st.events.filter(e=>e.company==='기아' && e.role==='SDV 전략기획').length,
    archive키:Object.keys(st.archived), ignoredOut키:Object.keys(st.ignoredOut),
    제안:st.outProposals.map(o=>({key:o.key,role:o.role})) };
});
await p.evaluate(() => document.getElementById('edCancel').click()); await p.waitForTimeout(200);
await p.evaluate(() => {
  window.__dbg.archive('현대자동차|미래사업전략', false);
  window.__dbg.state().events.filter(e=>e.company==='현대자동차').forEach(e=>e.result='');
  window.__dbg.save();
});
await p.waitForTimeout(200);

/* ── ③ 지원 안 함 ── */
await p.evaluate(() => { const s=document.getElementById('apBg'); if(s) s.classList.remove('open'); });
await openDetail('현대자동차');
R['08_지원예정이면_지원안함'] = await p.textContent('#apArchive');
await p.evaluate(() => document.getElementById('apArchive').click()); await p.waitForTimeout(500);
R['09_눌러도_삭제아님'] = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  return { 일정유지: st.events.length, archived: Object.keys(st.archived), 되돌리기: !document.getElementById('undoBar').hidden };
});
R['10_카드칩'] = await p.evaluate(async () => {
  document.querySelector('.tab[data-tab="apps"]').click();
  await new Promise(r=>setTimeout(r,350));
  const chip = [...document.querySelectorAll('[data-pc]')].find(b => b.textContent.includes('종료'));
  if (chip) chip.click();
  await new Promise(r=>setTimeout(r,350));
  const c = [...document.querySelectorAll('.appCard')].find(x=>x.querySelector('.acCo').textContent.trim()==='현대자동차');
  return c ? c.querySelector('.statusChip').textContent.trim() : '없음';
});
await p.evaluate(() => { const b=[...document.querySelectorAll('[data-pc]')]
  .find(x=>x.dataset.pc===''); if (b) b.click(); });
await p.waitForTimeout(400);
await openDetail('기아');
R['11_지원완료면_지원종료'] = await p.textContent('#apArchive');

/* 동기화가 켜져 있으면 어학 수정도 즉시 dirty 로 잡혀야 한다 */
await p.evaluate(() => localStorage.setItem('jobRadarSyncCfg', JSON.stringify({
  url:'http://127.0.0.1:8877', key:'k', room:'jr-uxtest-000000000000',
  baseRev:1, dirty:false, deviceId:'d-ux' })));
await p.reload({ waitUntil:'domcontentloaded' });
await p.waitForTimeout(1600);
R['13_어학수정시_dirty'] = await p.evaluate(async () => {
  const before = JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty;
  window.__dbg.quals().push({ id:'qz', type:'OPIc', score:null, grade:'IH',
    testDate:'2026-05-01', resultDate:'2026-05-10', validUntil:'' });
  window.__dbg.save();
  await new Promise(r=>setTimeout(r,300));
  return { 수정전: before, 수정후: JSON.parse(localStorage.getItem('jobRadarSyncCfg')).dirty };
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length?errs:'none');
await b.close();

