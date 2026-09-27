import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const B = 'http://127.0.0.1:8899/';
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const c = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await c.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
const p = await c.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => m.type()==='error' && errs.push(m.text()));
const n0 = new Date();
const dstr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const soon = new Date(n0.getFullYear(), n0.getMonth(), Math.min(n0.getDate()+2, 27));
const past = new Date(n0.getFullYear(), n0.getMonth(), Math.max(n0.getDate()-3, 1));
await p.addInitScript(([d1, d2]) => {
  const ev = (id,co,stage,date) => ({id,company:co,role:'전략기획',tier:'S',status:'',
    date,time:'',stage,kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''});
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[ev('a1','현대카드','apply',d1), ev('a2','SK하이닉스','test',d1), ev('a3','기아','apply',d2)],
    axes:{}, inbox:[], dismissed:[], archived:{}, seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
}, [dstr(soon), dstr(past)]);
await p.goto(B, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);

const R = {};

/* ── #3 홈: 정상(동기화 꺼짐) 상태에서는 동기화 UI 가 홈에 없어야 한다 */
R['01_홈에_동기화row없음'] = await p.evaluate(() =>
  !document.getElementById('syncCfgBtn') && !document.getElementById('syncNowBtn'));
R['02_배너_정상일때숨김'] = await p.evaluate(() => document.getElementById('syncBar').hidden);
R['03_홈_storeLabel없음'] = await p.evaluate(() =>
  !document.getElementById('s-home').contains(document.getElementById('storeLabel')));
R['04_storeLabel은시트안'] = await p.evaluate(() =>
  document.getElementById('syncBg').contains(document.getElementById('storeLabel')));

/* dirty 상태를 만들면 배너가 떠야 한다 */
R['05_미동기화면_배너뜸'] = await p.evaluate(() => {
  window.__dbg.setSyncUI('warn', '변경사항 미동기화 · 눌러서 올리기');
  const el = document.getElementById('syncBar');
  return { hidden: el.hidden, text: document.getElementById('syncText').textContent };
});
R['06_실패면_빨강'] = await p.evaluate(() => {
  window.__dbg.setSyncUI('err', '동기화 실패 · 눌러서 다시 시도');
  const el = document.getElementById('syncBar');
  return { hidden: el.hidden, cls: el.className };
});
R['07_정상복귀하면_다시숨김'] = await p.evaluate(() => {
  window.__dbg.setSyncUI('', '이 기기에만 저장됨');
  return document.getElementById('syncBar').hidden;
});

/* ── #4 «오늘» 텍스트 버튼 */
await p.click('.tab[data-tab="cal"]');
await p.waitForTimeout(300);
R['08_오늘버튼'] = await p.evaluate(() => {
  const t = document.getElementById('todayBtn');
  return { hidden: t.hidden, text: t.textContent.trim(), svg: !!t.querySelector('svg'),
           w: Math.round(t.getBoundingClientRect().width) };
});
// 다른 달로 옮긴 뒤 «오늘» 을 누르면 이번 달로 돌아온다
R['09_오늘동작'] = await p.evaluate(async () => {
  document.getElementById('prevMonth').click();
  document.getElementById('prevMonth').click();
  const moved = document.getElementById('calTitle').textContent;
  document.getElementById('todayBtn').click();
  const n = new Date();
  return { moved, back: document.getElementById('calTitle').textContent,
           expect: `${n.getFullYear()}년 ${n.getMonth()+1}월` };
});

/* ── #5 day 셀이 button 인가 */
R['10_day는button'] = await p.evaluate(() => {
  const ds = [...document.querySelectorAll('.day[data-day]')];
  return { n: ds.length, allButton: ds.every(d => d.tagName === 'BUTTON'),
           type: ds[0].getAttribute('type'), aria: ds[0].getAttribute('aria-label') };
});
R['11_빈칸은focus불가'] = await p.evaluate(() =>
  [...document.querySelectorAll('.day.empty')].every(d => d.tagName === 'DIV'));
R['12_키보드로이동'] = await p.evaluate(async () => {
  const f = document.querySelector('#calList .pastFold'); if (f) f.open = true;
  const d = [...document.querySelectorAll('.day[data-day]')].find(x => x.querySelector('.cdot'));
  if (!d) return 'no-event-day';
  d.focus();
  const focused = document.activeElement === d;
  d.click();
  await new Promise(r => setTimeout(r, 400));
  const t = document.getElementById('cd-' + d.dataset.day);
  return { focused, 그날블록있음: !!t, 하이라이트: !!t && t.classList.contains('flash') };
});
R['12b_시트없음'] = await p.evaluate(() => !document.getElementById('dayBg'));
R['12c_목록이_상주'] = await p.evaluate(() => ({
  행수: document.querySelectorAll('#calList .evRow').length,
  회사보임: [...document.querySelectorAll('#calList .evCo')].map(x => x.textContent.trim()).slice(0,3)
}));

/* ── #1 캘린더 남는 영역이 흰색으로 이어지는가 */
R['13_캘린더여백'] = await p.evaluate(() => {
  const s = document.getElementById('s-cal'), r = s.getBoundingClientRect();
  const cal = document.getElementById('calendar').getBoundingClientRect();
  return { bg: getComputedStyle(s).backgroundColor,
           섹션높이: Math.round(r.height), 달력끝: Math.round(cal.bottom - r.top),
           달력아래여백: Math.round(r.bottom - cal.bottom) };
});
R['14_여백픽셀이_흰색'] = await p.evaluate(() => {
  const s = document.getElementById('s-cal').getBoundingClientRect();
  const y = Math.round(s.bottom - 12), x = 195;
  const el = document.elementFromPoint(x, y);
  if (!el) return 'null';
  let n = el, bg = 'rgba(0, 0, 0, 0)';
  while (n && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
  return { el: el.id || el.className || el.tagName, bg };
});

/* ── #2 안내문이 실제 규칙과 맞는가 */
R['15_안내문'] = await p.evaluate(() =>
  document.querySelector('#s-cal .footNote').textContent.trim());
R['16_안내문_거짓말없음'] = await p.evaluate(() => {
  const t = document.querySelector('#s-cal .footNote').textContent;
  return !t.includes('회색으로 자취');   // 종료 건은 점이 회색이 되지만 «자취만 남는다» 는 과장
});

/* ── 더보기 IA (#원본리뷰 «11행 4그룹 전부 같은 무게» / «퍼스널 DB 두 번 등장») */
await p.click('.tab[data-tab="more"]');
await p.waitForTimeout(400);
R['17_그룹수'] = await p.evaluate(() =>
  [...document.querySelectorAll('#s-more .block')].length);
R['18_상단그룹_무게'] = await p.evaluate(() => {
  const lead = document.querySelector('.rowLead .rowT');
  const rest = document.querySelector('#syncBtn .rowT');
  return { lead: getComputedStyle(lead).fontSize, rest: getComputedStyle(rest).fontSize,
           다름: getComputedStyle(lead).fontSize !== getComputedStyle(rest).fontSize };
});
R['19_파괴적액션_접힘'] = await p.evaluate(() => {
  const d = document.getElementById('dangerZone');
  return { open: d.open,
    wipe보임: document.getElementById('wipeBtn').getBoundingClientRect().height > 0,
    handoff보임: document.getElementById('handoffBtn').getBoundingClientRect().height > 0 };
});
R['20_펼치면보임'] = await p.evaluate(async () => {
  const d = document.getElementById('dangerZone'); d.open = true;
  await new Promise(r => setTimeout(r, 120));
  return document.getElementById('handoffBtn').getBoundingClientRect().height > 0;
});
await p.evaluate(() => { document.getElementById('dangerZone').open = false; });

/* 퍼스널 DB 가 «진입» 과 «켜기/끄기» 로 두 번 같은 모양으로 있지 않아야 한다 */
R['21_DB중복없음'] = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('#s-more .row')]
    .filter(r => r.getBoundingClientRect().height > 0)
    .map(r => r.querySelector('.rowT').textContent.trim());
  const db = rows.filter(t => t.includes('퍼스널 기업 DB'));
  return { 보이는행: rows, DB행: db, chev있는DB: db.filter((_,i)=>0).length };
});
R['22_토글은스위치'] = await p.evaluate(() => {
  const t = document.getElementById('pdbToggle');
  return { role: t.getAttribute('role'), checked: t.getAttribute('aria-checked'),
           스위치: !!t.querySelector('.switch'), chev: !!t.querySelector('.chev') };
});
R['23_토글하면_진입행생김'] = await p.evaluate(async () => {
  document.getElementById('pdbToggle').click();
  await new Promise(r => setTimeout(r, 200));
  const t = document.getElementById('pdbToggle');
  return { checked: t.getAttribute('aria-checked'), on: t.classList.contains('on'),
           진입행: !document.querySelector('[data-go="db"]').hidden };
});

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

