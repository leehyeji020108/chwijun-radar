import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PE: '+e.message));
await p.route('**cdn.jsdelivr.net**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => localStorage.setItem('jobRadarStateV3', JSON.stringify({
  events:[], axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[],
  seedVersion:2, resultVersion:1, updatedAt:Date.now(),
  profile:{done:true,pdb:false,name:'준기',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
    excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'',createdAt:1}})));
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900);

const R = {};
const ev = (req, qs) => p.evaluate(([r,q]) => {
  const e = window.__dbg.evalElig(r, q);
  return e.label + ' | ' + e.reason;
}, [req, qs]);

// 준기의 실제 저장값 — 결과 발표 전이라 score/grade 가 없다
const PENDING = [{ id:'q1', type:'TOEIC Speaking', score:null, grade:null,
  testDate:'2026-09-09', resultDate:'2026-09-12', validUntil:'' }];
const IM3 = [{ ...PENDING[0], grade:'IM3' }];
const AL  = [{ ...PENDING[0], grade:'AL'  }];

/* ── 핵심: 결과 전이면 절대 «미달» 이라고 하지 않는다 ── */
R['01_AL요건_결과대기'] = await ev('TOEIC Speaking AL 이상', PENDING);
R['02_AL요건_IM3나오면_미달'] = await ev('TOEIC Speaking AL 이상', IM3);
R['03_AL요건_AL나오면_충족'] = await ev('TOEIC Speaking AL 이상', AL);
R['04_IM2요건_IM3면_충족'] = await ev('토익스피킹 IM2 이상', IM3);
R['05_요건없음'] = await ev('', PENDING);
R['06_성적없음_확인필요'] = await ev('OPIc IH 이상', PENDING);
R['07_못읽으면_확인필요'] = await ev('영어 능통자 우대', PENDING);

/* 표기 흔들림 흡수 */
R['08_토스표기'] = await ev('토스 AL 이상', PENDING);
R['09_공백표기'] = await ev('TOEIC Speaking  AL 이상', IM3);
R['10_숫자시험'] = await ev('TOEIC 700 이상', [{id:'t',type:'TOEIC',score:850,grade:null,
  testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}]);
R['11_숫자미달'] = await ev('TOEIC 900 이상', [{id:'t',type:'TOEIC',score:850,grade:null,
  testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}]);
R['12_만료된성적'] = await ev('TOEIC 700 이상', [{id:'t',type:'TOEIC',score:850,grade:null,
  testDate:'2020-01-01',resultDate:'2020-01-10',validUntil:'2022-01-01'}]);

/* ══ AND / OR 구조 ══
 *  OR : 하나만 되면 되므로 «대기» 가 «미달» 을 이긴다
 *  AND: 다 돼야 하므로 «확정 미달» 이 «대기» 를 이긴다 */
const TOEIC850 = [{id:'t',type:'TOEIC',score:850,grade:null,
  testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}];

R['13_OR_대기가이김'] = await ev('TOEIC 900 이상 또는 TOEIC Speaking AL 이상',
  [...TOEIC850, ...PENDING]);
R['13b_OR_슬래시'] = await ev('TOEIC 900 / TOEIC Speaking AL 이상', [...TOEIC850, ...PENDING]);
R['13c_OR_중하나'] = await ev('TOEIC 900 이상, TOEIC Speaking AL 이상 중 하나',
  [...TOEIC850, ...PENDING]);
R['13d_OR_하나충족이면_충족'] = await ev('TOEIC 900 이상 또는 TOEIC Speaking AL 이상',
  [{id:'t',type:'TOEIC',score:950,grade:null,testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}, ...PENDING]);

R['14_AND_확정미달이이김'] = await ev('TOEIC 900 이상 및 TOEIC Speaking AL 이상',
  [...TOEIC850, ...PENDING]);
R['14b_AND_그리고'] = await ev('TOEIC 900 이상 그리고 TOEIC Speaking AL 이상',
  [...TOEIC850, ...PENDING]);
R['14c_AND_둘다대기면_대기'] = await ev('TOEIC 900 이상 및 TOEIC Speaking AL 이상', PENDING);
R['14d_AND_둘다충족'] = await ev('TOEIC 700 이상 및 TOEIC Speaking IM2 이상',
  [...TOEIC850, ...IM3]);
R['14e_AND_어학외필수는_어학만본다'] = await ev('TOEIC 900 이상 및 한국사 1급 필수', TOEIC850);

R['15_접속어없으면_택1로읽고_알린다'] = await ev('TOEIC 900 이상 TOEIC Speaking AL 이상',
  [...TOEIC850, ...PENDING]);

/* status 파생이 저장값이 아니라 계산이어야 한다 */
R['16_status파생'] = await p.evaluate(([a,b2]) => [window.__dbg.qualStatus(a), window.__dbg.qualStatus(b2)],
  [PENDING[0], IM3[0]]);

/* 9/12 에 결과를 넣으면 모든 판정이 그 자리에서 다시 계산되는가 */
R['17_결과입력후_자동재계산'] = await p.evaluate(() => {
  const q = window.__dbg.quals();
  q.push({ id:'x', type:'TOEIC Speaking', score:null, grade:null,
           testDate:'2026-09-09', resultDate:'2026-09-12', validUntil:'' });
  const before = window.__dbg.evalElig('TOEIC Speaking AL 이상').label;
  q[0].grade = 'IM3';                       // 9/12 결과 입력
  const after  = window.__dbg.evalElig('TOEIC Speaking AL 이상').label;
  q[0].grade = 'AL';
  const after2 = window.__dbg.evalElig('TOEIC Speaking AL 이상').label;
  return { 결과전: before, IM3: after, AL: after2 };
});

/* ══ 발표일이 지났는데 점수가 없으면 «결과 대기» 로 남으면 안 된다 ══ */
const shift = d => p.evaluate(n => {
  const t = new Date(); t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}, d);
const mk = async (n) => [{ id:'q', type:'TOEIC Speaking', score:null, grade:null,
  testDate: await shift(n - 3), resultDate: n === null ? '' : await shift(n), validUntil:'' }];

R['18_발표일_내일'] = await ev('TOEIC Speaking AL 이상', await mk(1));
R['19_발표일_오늘'] = await ev('TOEIC Speaking AL 이상', await mk(0));
R['20_발표일_어제'] = await ev('TOEIC Speaking AL 이상', await mk(-1));
R['21_발표일_없음'] = await ev('TOEIC Speaking AL 이상',
  [{ id:'q', type:'TOEIC Speaking', score:null, grade:null, testDate:'', resultDate:'', validUntil:'' }]);
R['22_status_4종'] = await p.evaluate(async () => {
  const d = n => { const t = new Date(); t.setDate(t.getDate()+n);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
  const q = (o) => window.__dbg.qualStatus(Object.assign(
    { type:'TOEIC Speaking', score:null, grade:null, testDate:'', resultDate:'', validUntil:'' }, o));
  return { 발표전: q({ resultDate: d(1) }), 발표당일: q({ resultDate: d(0) }),
           발표지남: q({ resultDate: d(-1) }), 날짜없음: q({}),
           성적있음: q({ grade:'AL' }), 만료: q({ grade:'AL', validUntil: d(-1) }) };
});

/* ══ 판정 라벨은 «어학» 까지만 주장한다 ══ */
R['23_라벨_스코프'] = await p.evaluate(() => [
  window.__dbg.evalElig('', []).label,
  window.__dbg.evalElig('TOEIC 900 이상', [{type:'TOEIC',score:950,grade:null,
    testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}]).label,
  window.__dbg.evalElig('TOEIC 900 이상', [{type:'TOEIC',score:800,grade:null,
    testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}]).label,
  window.__dbg.evalElig('영어 능통자 우대', []).label
]);
R['24_비어학요건은_판정안함'] = await p.evaluate(() =>
  window.__dbg.evalElig('TOEIC 700 이상, 한국사 1급 필수', [{type:'TOEIC',score:950,grade:null,
    testDate:'2026-01-01',resultDate:'2026-01-10',validUntil:'2028-01-01'}]));

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length?errs:'none');
await b.close();

