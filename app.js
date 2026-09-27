/* 취준 Radar v6 — 모바일 앱 셸
 * 로직(파생 상태·검토함·동기화·PWA)은 v5 그대로, 화면 구조만 앱 형태로 재구성.
 */
(() => {
'use strict';

/* ═══════════ 상태 ═══════════ */
const LEGACY_KEY = 'jobRadarDataV1';
const KEY        = 'jobRadarStateV3';
const CFG_KEY    = 'jobRadarSyncCfg';
const RECOVERY_KEY = 'jobRadarRecovery';
const BADGE_KEY = 'jobRadarBadgeEnabled';

/* 공용 Supabase 프로젝트 — anon key 는 공개 전제이고, 실제 데이터는
   사용자의 '동기화 비밀키'로 브라우저에서 AES-GCM 암호화한 뒤 올라간다.
   서버에는 암호문만 남고 비밀키는 이 기기에만 저장된다. */
const PRODUCTION_SYNC_URL = 'https://qxejfgbrszcnejkrgiwu.supabase.co';
// QA는 fail-closed다. localhost에서 production Supabase를 향할 수 없게 앱 자체에서 막는다.
// 동기화 테스트는 qa/mockpg.mjs(8877)만 사용한다.
const DEFAULT_SYNC_URL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  ? 'http://127.0.0.1:8877' : PRODUCTION_SYNC_URL;
const DEFAULT_SYNC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZWpmZ2Jyc3pjbmVqa3JnaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTI3OTYsImV4cCI6MjA5NTg2ODc5Nn0.Yi3F1c64uBEg65MTtt3tdwCVpNjW4tJEtmDVxmLfWxo';

const KIND_TO_STAGE = { deadline:'apply', process:'test', open:'open', event:'info' };
const STATUS_ALIAS  = { '제출완료':'지원완료', '서류탈락':'불합격', '탈락':'불합격' };

function migrate(st) {
  if (!st || !Array.isArray(st.events)) return st;
  st.events.forEach(x => {
    if (!x.stage) x.stage = KIND_TO_STAGE[x.kind] || 'info';
    if (STATUS_ALIAS[x.status]) x.status = STATUS_ALIAS[x.status];
    if (typeof x.url !== 'string') x.url = '';
    if (typeof x.result !== 'string') x.result = '';
    if (typeof x.hold !== 'boolean') x.hold = false;
  });
  // 폐기된 v8.1.19가 자동 주입한 개인 실행계획만 정확한 ID로 제거한다.
  // 사용자가 직접 만든 일정과 지원 데이터는 건드리지 않는다.
  const retiredPlanIds = new Set([
    'plan-20260917-hanwha','plan-20260917-naver',
    'plan-20260918-hanwha','plan-20260918-naver','plan-20260918-woori',
    'plan-20260919-toeic','plan-20260919-hanwha','plan-20260919-naver',
    'plan-20260920-hanwha','plan-20260920-naver',
    'plan-20260921-naver','plan-20260921-woori',
    'plan-20260922-navercloud','plan-20260922-homeui',
    'plan-20260923-toeic','plan-20260923-navercloud','plan-20260923-homeui',
    'plan-20260924-cj','plan-20260924-myrealtrip',
    'plan-20260925-cj','plan-20260925-myrealtrip',
    'plan-20260926-myrealtrip','plan-20260926-kia',
    'plan-20260927-myrealtrip','plan-20260927-kia',
    'plan-20260928-myrealtrip','plan-20260928-kia',
    'plan-20260929-kia','plan-20260929-cj',
    'plan-20260930-cjfirst','plan-20260930-coupangeats'
  ]);
  st.events = st.events.filter(x => !retiredPlanIds.has(x.id));
  delete st.planVersion;
  if (!st.resultVersion) {                       // v4(수동 status) → v5(결과 기반)
    const byKey = new Map();
    st.events.forEach(x => {
      const k = `${x.company}|${x.role}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(x);
    });
    for (const items of byKey.values()) {
      const s0 = items[items.length - 1].status || '';
      const apply = items.find(i => i.stage === 'apply');
      if (s0 === '검증필요' || s0 === 'WATCH') items.forEach(i => i.hold = true);
      if (apply) {
        if (s0 === '지원완료') apply.result = apply.result || 'submitted';
        if (['서류합격','검사·면접','최종합격'].includes(s0)) apply.result = apply.result || 'pass';
      }
      if (s0 === '최종합격') { const f = items.find(i => i.stage === 'final'); if (f) f.result = 'pass'; }
      if (s0 === '불합격') {
        const past = items.filter(i => dObj(i.date, i.time) <= new Date());
        (past[past.length - 1] || items[0]).result = 'fail';
      }
    }
    st.resultVersion = 1;
  }
  st.axes = st.axes || {};
  st.inbox = Array.isArray(st.inbox) ? st.inbox : [];
  st.dismissed = Array.isArray(st.dismissed) ? st.dismissed : [];
  // 지원 종료(보관)는 status 와 독립된 overlay 다. 원래 상태는 그대로 둔다.
  // key 는 company|role — 이번 시즌 한정. applicationId 가 생기면 ID 기반으로 옮긴다.
  st.archived = (st.archived && typeof st.archived === 'object' && !Array.isArray(st.archived)) ? st.archived : {};
  st.profile = st.profile || emptyProfile();
  // v8.1 — 내 어학·자격. 결과 전이면 score/grade 는 null 이고 status 는 pending 이다.
  st.qualifications = Array.isArray(st.qualifications) ? st.qualifications : [];
  // GPT 가 제안한 «종료» 는 제안일 뿐이다. 승인 전에는 아무것도 바뀌지 않는다.
  st.outProposals = Array.isArray(st.outProposals) ? st.outProposals : [];
  // «무시» 는 영구 삭제도 매번 재질문도 아니다. 무시한 시점의 근거(basis)를 적어두고,
  // 근거가 그대로면 조용히 숨기고 근거가 바뀌면 다시 묻는다.
  st.ignoredOut = (st.ignoredOut && typeof st.ignoredOut === 'object' && !Array.isArray(st.ignoredOut))
    ? st.ignoredOut : {};
  // 채용 레이더 가져오기 기록은 기기간 동기화 상태와 섞지 않는다.
  st.radarMeta = (st.radarMeta && typeof st.radarMeta === 'object' && !Array.isArray(st.radarMeta))
    ? st.radarMeta : { lastImportAt:0, lastCandidateCount:0, lastNewCount:0 };
  st.radarSeen = (st.radarSeen && typeof st.radarSeen === 'object' && !Array.isArray(st.radarSeen)) ? st.radarSeen : {};
  st.radarIdentity = (st.radarIdentity && typeof st.radarIdentity === 'object' && !Array.isArray(st.radarIdentity)) ? st.radarIdentity : {};
  // v8.1 — 저장돼 있던 프롬프트를 버린다. 계산 결과를 원본처럼 들고 있던 게 문제였다.
  if (st.profile && st.profile.prompt) { st.profile.prompt = ''; st.profile.promptVersion = 3; }
  st.qualifications.forEach(q => {
    if (typeof q.type !== 'string') q.type = '';
    if (q.score === undefined) q.score = null;
    if (q.grade === undefined) q.grade = null;
    ['testDate','resultDate','validUntil'].forEach(k => { if (typeof q[k] !== 'string') q[k] = ''; });
  });
  return st;
}

/* ═══════════ 어학·자격 (v8.1) ═══════════
 * status 는 저장하지 않고 매번 계산한다 — 9/12 결과가 들어오는 순간 저절로 바뀌어야 하므로.
 *   pending  결과 발표 전 (score·grade 가 아직 없음)
 *   expired  유효기간 지남
 *   valid    쓸 수 있는 성적 */
function qualStatus(q) {
  const has = (q.score !== null && q.score !== undefined && q.score !== '')
           || (q.grade !== null && q.grade !== undefined && q.grade !== '');
  if (!has) {
    // 발표일 «전» 일 때만 대기다. 발표일이 지났는데 비어 있으면 넣어야 할 값이 안 들어온 것이다.
    // (안 그러면 9/13 에도 «결과 대기 · 09/12 발표» 가 영원히 남는다)
    if (q.resultDate && todayStr() < q.resultDate) return 'pending';
    return 'needsInput';
  }
  if (q.validUntil && q.validUntil < todayStr()) return 'expired';
  return 'valid';
}
const QUAL_STATUS_LABEL = { valid:'유효', pending:'결과 대기',
                            needsInput:'결과 입력 필요', expired:'만료' };
const quals = () => (state.qualifications = Array.isArray(state.qualifications) ? state.qualifications : []);

const QUAL_TYPES = ['TOEIC Speaking','OPIc','TOEIC','TEPS','TOEFL','IELTS','기타'];
const VERDICT_CLS = { ok:'eg-ok', short:'eg-short', waiting:'eg-wait', check:'eg-check' };

/* 말하기 시험 등급 사다리 — TOEIC Speaking · OPIc 이 같은 체계를 쓴다 */
const SPEAK_LADDER = ['NL','NM','NH','IL','IM1','IM2','IM3','IH','AL','AM','AH'];
const speakRank = g => SPEAK_LADDER.indexOf(String(g || '').toUpperCase().replace(/\s/g,''));

/** 시험 이름을 정규화한다. 표기가 제각각이라 여기서 한 번에 흡수한다. */
function normTest(s0) {
  const t = String(s0 || '').toUpperCase().replace(/[\s·.]/g, '');
  if (/TOEICSPEAKING|TOEICS\b|토익스피킹|토스/.test(t)) return 'TOEIC_S';
  if (/OPIC|오픽/.test(t)) return 'OPIC';
  if (/TEPS|텝스/.test(t)) return 'TEPS';
  if (/TOEFL|토플/.test(t)) return 'TOEFL';
  if (/TOEIC|토익/.test(t)) return 'TOEIC';
  if (/IELTS|아이엘츠/.test(t)) return 'IELTS';
  return '';
}
const TEST_LABEL = { TOEIC_S:'토익스피킹', OPIC:'오픽', TEPS:'텝스',
                     TOEFL:'토플', TOEIC:'토익', IELTS:'IELTS' };
const IS_SPEAK = k => k === 'TOEIC_S' || k === 'OPIC';

/* 요건 문구의 접속 구조. 이게 판정을 가른다 —
 *   OR  «TOEIC 900 또는 토스 AL»  → 하나만 되면 된다 → 대기가 미달을 이긴다
 *   AND «TOEIC 900 및 한국사 1급» → 다 돼야 한다 → 확정 미달이 대기를 이긴다 */
const OR_MARK  = /또는|혹은|중\s*(?:택|하나|1개|1)|이거나|\bor\b|\//i;
const AND_MARK = /및|그리고|\band\b|모두\s*충족|동시에|둘\s*다/i;

/** 한 덩어리에서 «시험 + 최소 기준» 을 전부 뽑는다. 못 읽으면 빈 배열. */
function extractReqs(str) {
  const out = [];
  const re = /(토익\s*스피킹|TOEIC\s*Speaking|토스|OPIc|오픽|텝스|TEPS|토플|TOEFL|토익|TOEIC|IELTS)[^0-9A-Za-z가-힣]{0,6}((?:AL|AM|AH|IH|IM[123]|IM|IL|NH|NM|NL)|\d{2,4}(?:\.\d)?)/gi;
  let m;
  while ((m = re.exec(str))) {
    const key = normTest(m[1]);
    if (!key) continue;
    const v = String(m[2]).toUpperCase();
    if (IS_SPEAK(key)) { if (speakRank(v) >= 0) out.push({ key, grade: v }); }
    else out.push({ key, score: parseFloat(v) });
  }
  return out;
}

/** 요건 문구를 «AND 로 묶인 OR 그룹들» 로 읽는다. 추측하지 않는다 — 못 읽으면 null. */
function parseRequirement(text) {
  const raw = String(text || '').trim();
  if (!raw) return { none: true };
  const hasOr = OR_MARK.test(raw), hasAnd = AND_MARK.test(raw);
  let groups = [];
  if (hasAnd) {
    // AND 가 명시되면 그 지점에서 자른다. 잘린 조각 안의 시험들은 서로 OR.
    raw.split(/\s*(?:및|그리고|\band\b|[;\n]|,)\s*/i).forEach(chunk => {
      const alts = extractReqs(chunk);
      if (alts.length) groups.push(alts);
    });
  } else {
    // OR 가 명시됐거나 접속어가 없으면 한 그룹. 국내 공고의 공인어학은 대체 가능이 기본이다.
    const all = extractReqs(raw);
    if (all.length) groups = [all];
  }
  if (!groups.length) return null;
  return { groups, ambiguous: !hasOr && !hasAnd && groups[0].length > 1 };
}

/** ═══ 순수 계산기 ═══
 *  UI(요건 배지)와 GPT 프롬프트가 «같은 결과» 를 써야 판단이 어긋나지 않는다.
 *  verdict: ok 충족 | short 미달 | waiting 결과 대기 | check 확인 필요 */
function evaluateEligibility(reqText, qs) {
  const req = parseRequirement(reqText);
  if (!req) return { verdict:'check', label:'어학 확인 필요',
                     reason:'어학 요건을 자동으로 읽지 못했습니다' };
  if (req.none) return { verdict:'ok', label:'어학 충족', reason:'어학 요건 없음' };

  const list = Array.isArray(qs) ? qs : [];
  /** 요건 하나에 대한 판정 */
  const one = r => {
    const mine = list.filter(q => normTest(q.type) === r.key);
    if (!mine.length) return { v:'check', why:`${TEST_LABEL[r.key]} 성적 없음` };
    const valid = mine.filter(q => qualStatus(q) === 'valid');
    const pend  = mine.filter(q => qualStatus(q) === 'pending');
    const need  = mine.filter(q => qualStatus(q) === 'needsInput');
    if (!valid.length) {
      if (pend.length) {
        const d = pend.map(q => q.resultDate).filter(Boolean).sort()[0];
        return { v:'waiting', why:`${TEST_LABEL[r.key]} 결과 대기${d ? ` · ${d.slice(5).replace('-','/')} 발표` : ''}` };
      }
      if (need.length) {
        const d = need.map(q => q.resultDate).filter(Boolean).sort().pop();
        return { v:'check', why:`${TEST_LABEL[r.key]} 결과 입력 필요${
          d ? ` · ${d.slice(5).replace('-','/')} 발표됨` : ''}` };
      }
      return { v:'check', why:`${TEST_LABEL[r.key]} 성적 만료` };
    }
    if (IS_SPEAK(r.key)) {
      const best = Math.max(...valid.map(q => speakRank(q.grade)));
      if (best < 0) return { v:'check', why:`${TEST_LABEL[r.key]} 등급을 읽지 못함` };
      return best >= speakRank(r.grade)
        ? { v:'ok', why:`${TEST_LABEL[r.key]} ${SPEAK_LADDER[best]} ≥ ${r.grade}` }
        : { v:'short', why:`${TEST_LABEL[r.key]} ${SPEAK_LADDER[best]} < ${r.grade}` };
    }
    const best = Math.max(...valid.map(q => Number(q.score) || 0));
    return best >= r.score
      ? { v:'ok', why:`${TEST_LABEL[r.key]} ${best} ≥ ${r.score}` }
      : { v:'short', why:`${TEST_LABEL[r.key]} ${best} < ${r.score}` };
  };

  // OR 그룹 안 — «될 가능성» 이 높은 쪽이 이긴다.
  //   하나라도 충족이면 충족. 아직 모르는 것(대기·확인)은 미달을 덮는다.
  const OR_ORDER  = ['ok','waiting','check','short'];
  // AND 그룹 사이 — «확정된 사실» 이 이긴다.
  //   하나라도 확정 미달이면, 다른 게 대기 중이어도 이미 미달이다.
  const AND_ORDER = ['short','check','waiting','ok'];

  const gr = req.groups.map(alts => {
    const rs = alts.map(one);
    const best = rs.reduce((a,b) => OR_ORDER.indexOf(a.v) <= OR_ORDER.indexOf(b.v) ? a : b);
    return { v: best.v, why: rs.map(r => r.why).join(alts.length > 1 ? ' 또는 ' : '') };
  });
  const final = gr.reduce((a,b) => AND_ORDER.indexOf(a.v) <= AND_ORDER.indexOf(b.v) ? a : b);

  // 이 계산기는 공인어학만 읽는다. 그러니 라벨도 «어학» 까지만 주장한다.
  const LABEL = { ok:'어학 충족', short:'어학 미달',
                  waiting:'어학 결과 대기', check:'어학 확인 필요' };
  const why = gr.map(g => g.why).join(' + ')
    + (req.ambiguous ? ' (접속어가 없어 «택 1» 로 읽었습니다)' : '');
  return { verdict: final.v, label: LABEL[final.v], reason: why };
}


function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.events)) return migrate({ axes:{}, updatedAt:0, ...s }); }
  } catch (e) {}
  try {
    const l = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (Array.isArray(l) && l.length) return migrate({ events:l, axes:{}, inbox:[], dismissed:[], updatedAt:Date.now() });
  } catch (e) {}
  // 신규 설치는 완전히 빈 상태로 시작한다. 데이터도 기준도 없다.
  return blankState(emptyProfile(), 0);
}

/** 신규·초기화 상태도 migrate 를 거친 상태와 같은 shape 를 가져야 한다. */
function blankState(pf, updatedAt = Date.now()) {
  return { events:[], axes:{}, inbox:[], dismissed:[], archived:{},
    qualifications:[], outProposals:[], ignoredOut:{},
    radarMeta:{ lastImportAt:0, lastCandidateCount:0, lastNewCount:0 },
    radarSeen:{}, radarIdentity:{}, profile:pf || emptyProfile(),
    seedVersion:SEED_VERSION, resultVersion:1, updatedAt };
}

let state = loadState();
const events = () => state.events;
/** 저장 실패(용량 초과 등)를 숨기지 않는다. 화면 위에 계속 띄운다. */
let saveBroken = false;
function showSaveError(on, msg) {
  saveBroken = on;
  const el = $('saveErr'); if (!el) return;
  el.hidden = !on;
  if (on) el.textContent = msg || '저장하지 못했습니다 — 이 기기의 저장 공간을 확인하세요. 지금 변경한 내용은 사라질 수 있습니다.';
}
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); if (saveBroken) showSaveError(false); return true; }
  catch (e) {
    showSaveError(true, e && e.name === 'QuotaExceededError'
      ? '저장 공간이 가득 찼습니다 — 백업을 내려받고 오래된 데이터를 정리하세요.'
      : '저장하지 못했습니다 — 지금 변경한 내용은 사라질 수 있습니다.');
    return false;
  }
};
function save(push = true) {
  state.updatedAt = Date.now();
  const stored = persist();
  render();
  if (stored && push) schedulePush();
  // 저장하지 못한 메모리 상태를 원격의 정상 데이터로 올리지 않는다.
  if (!stored) clearTimeout(pushTimer);
  return stored;
}

const badgeEnabled = () => {
  try { return localStorage.getItem(BADGE_KEY) === '1'; } catch (e) { return false; }
};
const badgeSupported = () => typeof navigator.setAppBadge === 'function';
function renderBadgeSetting() {
  const btn = $('badgeBtn'), sum = $('badgeSum'); if (!btn || !sum) return;
  const on = badgeEnabled();
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  if (!badgeSupported()) sum.textContent = '이 휴대폰은 아이콘 숫자 표시를 지원하지 않습니다';
  else if (typeof Notification !== 'undefined' && Notification.permission === 'denied')
    sum.textContent = '휴대폰 알림 설정에서 권한을 켜주세요';
  else sum.textContent = on
    ? `켜짐 · 검토 대기 ${(state.inbox || []).length}건 표시`
    : '검토 대기 공고 수를 아이콘에 표시';
}
async function updateAppBadge() {
  if (!badgeSupported()) return;
  try {
    const count = badgeEnabled() ? (state.inbox || []).length : 0;
    if (count > 0) await navigator.setAppBadge(count);
    else if (typeof navigator.clearAppBadge === 'function') await navigator.clearAppBadge();
    else await navigator.setAppBadge(0);
  } catch (e) {}
}
async function toggleAppBadge() {
  if (!badgeSupported()) { toast('이 휴대폰에서는 앱 아이콘 숫자를 지원하지 않습니다'); return; }
  const next = !badgeEnabled();
  if (next && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    if (Notification.permission === 'denied') { toast('휴대폰 알림 설정에서 권한을 켜주세요'); return; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { toast('알림 권한이 있어야 아이콘 숫자를 표시할 수 있습니다'); return; }
  }
  try { localStorage.setItem(BADGE_KEY, next ? '1' : '0'); } catch (e) {}
  renderBadgeSetting(); await updateAppBadge();
  toast(next ? `아이콘에 검토 대기 ${(state.inbox || []).length}건을 표시합니다` : '아이콘 알림 숫자를 껐습니다');
}

/** 되돌리기용 자동 스냅샷. 파괴적인 작업 직전에 부른다. (#44) */
function checkpoint(tag) {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ at: Date.now(), tag: tag || '', state: raw }));
  } catch (e) {}
}

/* ═══════════ 유틸 ═══════════ */
const $  = id => document.getElementById(id);
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const dObj = (d, t = '23:59') => {
  const [y,m,dd] = String(d).split('-').map(Number);
  const [h,mi]   = (t || '23:59').split(':').map(Number);
  return new Date(y, m-1, dd, h||0, mi||0);
};
const fmt  = x => { const [,m,d] = x.date.split('-'); return `${+m}/${+d}${x.time ? ' '+x.time : ''}`; };
const days = x => { const t = new Date(); t.setHours(0,0,0,0);
                    const d = dObj(x.date,'00:00'); d.setHours(0,0,0,0);
                    return Math.round((d - t) / 86400000); };
const pad2 = n => String(n).padStart(2,'0');
const todayStr = () => { const n = new Date(); return `${n.getFullYear()}-${pad2(n.getMonth()+1)}-${pad2(n.getDate())}`; };

const stageOf = x => STAGES.find(s => s.key === x.stage) || STAGES[1];
const isCert  = x => x.stage === CERT_STAGE || x.stage === 'plan' || x.plan === true;
const isPast  = x => dObj(x.date, x.time) < new Date();
const tierCls = t => t === 'S+' ? 'tier-splus' : t === 'S' ? 'tier-s'
                  : (t === 'A+' || t === 'A') ? 'tier-a' : 'tier-w';
const impCls  = (tier, cert) => cert ? '' : tier === 'S+' ? 'imp-splus' : tier === 'S' ? 'imp-s' : '';
const dLabel  = x => { const d = days(x); return d <= 0 ? '오늘' : d === 1 ? '내일' : `D-${d}`; };

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
/** http(s) 가 아닌 주소는 링크로 만들지 않는다 (javascript: 등 차단) */
const safeUrl = u => { try { const p = new URL(String(u)); return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : ''; }
                       catch (e) { return ''; } };
const goLink = (x, label = '채용 ↗') => safeUrl(x.url)
  ? `<a class="chip golink" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${label}</a>` : '';
const bindGoLinks = () => qsa('.golink').forEach(a => a.onclick = e => e.stopPropagation());

/* ═══════════ 프로필 ═══════════ */
function emptyProfile() {
  return { done:false, name:'', grad:'', major:'', jobs:[],
           axisOrder:[], criteria:{}, excludeCompanies:[], excludeRoles:[],
           strength:'', want:'', avoid:'', prompt:'', pdb:false, createdAt:0 };
}
const profile = () => state.profile || (state.profile = emptyProfile());

/** 이 사람의 제외 규칙. 설문에서 적은 회사·직무로 만들어진다. */
function myRules() {
  const pf = profile();
  const rules = [];
  (pf.excludeCompanies || []).forEach(c => {
    if (c && c.trim()) rules.push({ match:c.trim(), kind:'BEN', text:'내가 제외한 회사' });
  });
  (pf.excludeRoles || []).forEach(r => {
    if (r && r.trim()) rules.push({ match:'', roleOnly:r.trim(), kind:'ROUTE', text:`제외한 직무·근무형태: ${r.trim()}` });
  });
  return rules;
}

/* ═══════════ 보정 규칙 / 평가축 ═══════════ */
function overrideFor(company, role) {
  const c = String(company || '').toLocaleLowerCase('ko'), r = String(role || '').toLocaleLowerCase('ko');
  for (const rule of myRules()) {
    if (rule.roleOnly) { if (r.includes(rule.roleOnly.toLocaleLowerCase('ko'))) return rule; continue; }
    if (c.includes(rule.match.toLocaleLowerCase('ko'))) return rule;
  }
  return null;
}
const isExcluded = rule => !!rule && (rule.kind === 'BEN' || rule.kind === 'ROUTE');
const axesOf = c => state.axes[c] || null;
function myAxes() {
  const pf = profile();
  const w = pf.axisOrder && pf.axisOrder.length ? weightsFromOrder(pf.axisOrder) : null;
  return VALUE_AXES.map(a => ({ ...a, w: w ? (w[a.key] ?? 0.5) : 1 }));
}
function axesScore(c) {
  const a = axesOf(c); if (!a) return null;
  let sum = 0, w = 0;
  for (const ax of myAxes()) if (typeof a[ax.key] === 'number') { sum += a[ax.key]*ax.w; w += 5*ax.w; }
  return w ? Math.round((sum/w)*1000)/10 : null;
}
function setAxis(c, key, val) {
  const a = state.axes[c] || (state.axes[c] = {});
  a[key] = (a[key] === val) ? 0 : val;
  save();
}

/* ═══════════ 지원 건 ═══════════ */
const appKey = x => `${x.company}|${x.role}`;
const sIdx = k => STAGE_ORDER.indexOf(k);

/** 상태는 «사람이 입력한 결과»로만 올라간다.
 *  날짜가 지났다는 이유만으로는 절대 진전시키지 않는다.
 *  마감/발표일이 지났는데 결과가 비어 있으면 상태는 그대로 두고
 *  pendingResult() 가 «결과 입력» 요청 줄을 띄운다. */
function deriveStatus(items) {
  if (items.some(i => i.hold)) return '보류';
  if (items.some(i => i.result === 'fail')) return '불합격';

  const final = items.find(i => i.stage === 'final');
  if (final && final.result === 'pass') return '최종합격';

  // 검사·면접을 실제로 통과했다
  if (items.some(i => ['test','interview'].includes(i.stage) && i.result === 'pass')) return '검사·면접';

  const apply  = items.find(i => i.stage === 'apply');
  const result = items.find(i => i.stage === 'result');
  const docPass = (apply && apply.result === 'pass') || (result && result.result === 'pass');

  if (docPass) {
    // 서류를 통과했고 다음 전형이 잡혀 있으면 그 단계로 본다
    return items.some(i => ['test','interview'].includes(i.stage)) ? '검사·면접' : '서류합격';
  }
  if (apply && apply.result === 'submitted') return '지원완료';
  return '지원예정';
}
function pendingResult(items) {
  // 설명회·자격·공고오픈은 채용 상태를 결정하는 결과가 아니므로 캐묻지 않는다.
  // (상세에서 사용자가 원하면 참석/완료를 직접 남길 수 있다)
  return items.filter(i => isPast(i) && !i.result && !['open','info','cert','plan'].includes(i.stage))
              .sort((a,b) => dObj(b.date,b.time) - dObj(a.date,a.time))[0] || null;
}

/* ═══════════ 지원 종료(보관) ═══════════
 * «기록을 없앤다» 가 아니라 «이제부터 행동할 필요가 없다» 는 뜻이다.
 * 종료 시점 이전 일정은 자취로 남기고, 이후 예정 일정만 숨긴다. */
const archMap = () => (state.archived = (state.archived && typeof state.archived === 'object'
  && !Array.isArray(state.archived)) ? state.archived : {});
const archivedAt = key => { const a = archMap()[key]; return a && a.at ? a.at : 0; };
const isArchived = key => !!archMap()[key];
/** 이 일정이 «종료 이후의 미래 일정» 인가 → 캘린더·홈·ICS 에서 숨긴다 */
function hiddenByArchive(x) {
  const at = archivedAt(appKey(x));
  return !!at && dObj(x.date, x.time).getTime() > at;
}
function archiveApp(key, on) {
  const m = archMap();
  if (on) m[key] = { at: Date.now() };
  else delete m[key];
  save();
}

function groups() {
  const map = new Map();
  for (const x of events()) {
    const k = appKey(x);
    if (!map.has(k)) map.set(k, { key:k, company:x.company, role:x.role, items:[] });
    map.get(k).items.push(x);
  }
  for (const g of map.values()) {
    g.items.sort((a,b) => dObj(a.date,a.time) - dObj(b.date,b.time));
    const lead = g.items[g.items.length-1];
    g.tier     = lead.tier;
    g.status   = deriveStatus(g.items);
    g.progress = STATUS_PROGRESS[g.status] ?? 0;
    g.hold     = g.items.some(i => i.hold);
    g.pending  = isArchived(g.key) ? null : pendingResult(g.items);   // 끝낸 지원에 결과를 다시 묻지 않는다
    g.isCert   = g.items.every(isCert);
    g.url      = (g.items.find(i => i.url) || {}).url || '';
    g.english  = (g.items.find(i => i.english) || {}).english || '';
    g.note     = (g.items.find(i => i.note) || {}).note || '';
    g.dropped  = g.status === '불합격';
    g.won      = g.status === '최종합격';
    g.archived = isArchived(g.key);
    g.archivedAt = archivedAt(g.key);
    g.closed   = g.dropped || g.won || g.archived;
    g.next     = g.items.find(i => !isPast(i)) || null;
    g.override = overrideFor(g.company, g.role);
    const applied = g.items.find(i => i.stage === 'apply');
    g.waitDays = (!g.closed && g.status === '지원완료' && applied && isPast(applied))
      ? Math.floor((new Date() - dObj(applied.date, applied.time)) / 86400000) : 0;
  }
  return [...map.values()];
}

function setResult(id, result) {
  const x = events().find(v => v.id === id); if (!x) return;
  x.result = result; save();
  if (result === 'pass' && x.stage !== 'final') setTimeout(() => {
    if (confirm(`${x.company} ${stageOf(x).label} 통과!\n다음 전형 일정을 지금 등록할까요?`)) addStage(appKey(x));
  }, 140);
}
/** 지원 건 하나를 통째로 삭제한다 (그 회사·직무의 모든 전형 일정) */
function deleteGroup(key) {
  const g = groups().find(v => v.key === key); if (!g) return;
  const n = g.items.length;
  if (!confirm(`${g.company} · ${g.role}\n전형 일정 ${n}건을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
  state.events = events().filter(x => appKey(x) !== key);
  save(); toast(`${g.company} 삭제됨 (${n}건)`);
}

function toggleHold(key) {
  const on = !events().some(x => appKey(x) === key && x.hold);
  events().forEach(x => { if (appKey(x) === key) x.hold = on; });
  save(); toast(on ? '보류로 표시했습니다' : '보류를 해제했습니다');
}

/* ═══════════ 라우터 ═══════════ */
const SCREENS = {
  home : { title:'취준 Radar', tab:'home',  actions:['installBtn'] },
  cal  : { title:'캘린더',      tab:'cal',   actions:['todayBtn','addBtn'] },
  apps : { title:'지원 관리',   tab:'apps',  actions:['addBtn'] },
  inbox: { title:'새 공고',     tab:'inbox', actions:[] },
  more : { title:'더보기',      tab:'more',  actions:[] },
  radar: { title:'커리어 레이더', tab:'more', back:'more', actions:[] },
  db   : { title:'퍼스널 기업 DB', tab:'more', back:'more', actions:[] }
};
let cur = 'home';

function go(id) {
  if (!SCREENS[id]) return;
  cur = id;
  const sc = SCREENS[id];
  qsa('.screen').forEach(s => s.hidden = true);
  $('s-' + id).hidden = false;
  $('abTitle').textContent = sc.title;
  $('abSub').textContent = id === 'home'
    ? new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' }) : '';
  $('backBtn').hidden = !sc.back;
  ['installBtn','todayBtn','addBtn'].forEach(a => {
    const on = sc.actions.includes(a);
    if (a === 'installBtn') $(a).hidden = !(on && deferredPrompt);
    else $(a).hidden = !on;
  });
  qsa('.tab').forEach(t => {
    const active=t.dataset.tab === sc.tab;
    t.classList.toggle('active', active);
    if(active) t.setAttribute('aria-current','page'); else t.removeAttribute('aria-current');
  });
  $('body').scrollTop = 0; window.scrollTo(0, 0);
}
qsa('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));
$('backBtn').onclick = () => go(SCREENS[cur].back || 'home');
qsa('[data-go]').forEach(b => b.onclick = () => {
  const t = b.dataset.go;
  if (t === 'importSheet') openSheet('impBg'); else go(t);
});
function applyProfileVisibility() {
  const pf = profile();
  const dbRow = qs('[data-go="db"]');
  if (dbRow) dbRow.hidden = !pf.pdb;
  const qSum = $('qualSum'); if (qSum) qSum.textContent = qualSummary();
  const tg = $('pdbToggle');
  if (tg) { tg.setAttribute('aria-checked', pf.pdb ? 'true' : 'false');
            tg.classList.toggle('on', !!pf.pdb); }
  $('obName') && ($('obName').textContent = (pf.jobs || []).filter(Boolean).join(' · ') || '희망 직무·가치축·제외 규칙');
  const help=$('utilityZone'); if(help) help.hidden=events().length>0;
}

/* ═══════════ 바텀시트 ═══════════ */
const sheetReturnFocus = new Map();
function openSheet(id) {
  if (id === 'impBg') renderRadarFreshness();
  const bg=$(id), wasOpen=bg.classList.contains('open');
  if(!wasOpen) sheetReturnFocus.set(id, document.activeElement);
  bg.inert=false; bg.setAttribute('aria-hidden','false'); bg.classList.add('open');
  document.body.style.overflow = 'hidden';
  if(!wasOpen) requestAnimationFrame(() => {
    const first=bg.querySelector('[autofocus],.sheetHead button,input:not([type="hidden"]),select,textarea,button,a[href]');
    if(first) first.focus({preventScroll:true});
  });
}
function closeSheet(id) {
  const bg=$(id); if(!bg) return;
  bg.classList.remove('open'); bg.inert=true; bg.setAttribute('aria-hidden','true');
  if(!qsa('.scrim.open').length) document.body.style.overflow = '';
  const back=sheetReturnFocus.get(id); sheetReturnFocus.delete(id);
  if(back && back.isConnected) requestAnimationFrame(() => back.focus({preventScroll:true}));
}
qsa('.scrim').forEach(s => s.onclick = e => { if (e.target === s) closeSheet(s.id); });
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  const open=qsa('.scrim.open').at(-1); if(!open) return;
  e.preventDefault(); closeSheet(open.id);
});

/* ═══════════ 렌더 ═══════════ */
let calYear, calMonth;
(function initMonth() {
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
})();

function render() {
  const gs = groups();
  renderNext(gs); renderFunnel(gs); renderUp(gs);
  renderCal(); renderApps(gs); renderRadar(gs); renderInbox(); renderDB();
  renderBadgeSetting(); updateAppBadge();
  if (openAppKey && $('apBg').classList.contains('open')) openApp(openAppKey);
}

/* ── 다음 할 일 ── */
/** 홈에서 «앞으로 할 일» 로 볼 후보. Hero 와 그다음 일정이 반드시 같은 조건을 쓴다.
 *  - 이미 지난 일정 제외 (오늘이라도 시간이 지났으면 뺀다)
 *  - 종료 이후의 미래 일정 제외
 *  - 종료·불합격·최종합격·보류 건 제외 */
function upcomingCandidates(gs) {
  return events()
    .filter(x => !isPast(x) && !hiddenByArchive(x))
    .filter(x => { const g = gs.find(v => v.key === appKey(x)); return g && !g.closed && !g.hold; })
    .sort((a, b) => dObj(a.date, a.time) - dObj(b.date, b.time));
}

/* ── 지금 해야 할 것 (1건) ── */
function renderNext(gs) {
  const up = upcomingCandidates(gs);
  const x = up[0];
  if (!x) {
    const none = !events().length;
    $('nextAction').innerHTML = none
      ? `<div class="empty">
           <b>아직 지원 건이 없습니다</b>
           <span>내 기준은 저장됐습니다. 이제 지원할 공고를 넣으면 됩니다.</span>
           <span class="emptyBtns">
             <button class="btn btnPrimary sm" id="emptyImport">새 공고 확인</button>
             <button class="btn btnGhost sm" id="emptyAdd">직접 추가</button>
           </span>
         </div>`
      : '<div class="empty">예정된 일정이 없습니다.</div>';
    if (none) {
      $('emptyImport').onclick = () => go('inbox');
      $('emptyAdd').onclick = () => { clearForm(); openSheet('modalBg'); };
    }
    return;
  }
  // 제목이 주인공이다. «오늘» 이 제목보다 커지지 않는다.
  const st = stageOf(x), u = urgency(x);
  const when = `${dLabel(x)}${x.time ? ` · ${x.time}` : ''} · ${st.label}`;
  $('nextAction').innerHTML = `
    <button class="hero ${impCls(x.tier, isCert(x))}" data-id="${esc(x.id)}">
      <span class="heroBody">
        <span class="heroTitle">${esc(isCert(x) ? x.role : x.company)}</span>
        <span class="heroWhen ${u.cls === 'now' ? 'now' : ''}">${esc(when)}</span>
        ${isCert(x) ? '' : `<span class="heroSub">${esc(x.role)}</span>`}
      </span>
      ${isCert(x) ? '' : `<span class="tier ${tierCls(x.tier)}">${esc(x.tier)}</span>`}
    </button>`;
  const n = qs('.hero[data-id]'); if (n) n.onclick = () => edit(n.dataset.id);
}

/** 종료(보관)한 건은 실시간 퍼널의 진행 단계에서 빠지고 «종료» 에만 잡힌다. */
const inBucket = (g, p) => p.key === '종료'
  ? (g.archived || p.match.includes(g.status))
  : (!g.archived && p.match.includes(g.status));

/* ── 지원 현황 — 0인 상태는 숨긴 compact row ── */
function renderFunnel(gs) {
  const active = $('pipeFilter').value;
  const rows = PIPELINE.map(p => ({ p, n: gs.filter(g => !g.isCert && inBucket(g, p)).length }))
                       .filter(v => v.n > 0);
  $('funnel').innerHTML = rows.length
    ? rows.map(({ p, n }) => `<button class="fstat ${active === p.key ? 'on' : ''}"
        data-funnel="${esc(p.key)}" title="${esc(p.hint)}"><b>${n}</b><span>${esc(p.key)}</span></button>`).join('')
    : '<div class="empty">아직 지원 건이 없습니다.</div>';
  qsa('[data-funnel]').forEach(b => b.onclick = () => {
    $('pipeFilter').value = $('pipeFilter').value === b.dataset.funnel ? '' : b.dataset.funnel;
    go('apps'); renderApps(groups()); renderFunnel(groups());
  });
}

/* ── 그다음 일정 — Hero 에 쓴 1건은 빼고 보여준다 (중복 제거) ── */
function renderUp(gs) {
  const xs = upcomingCandidates(gs).slice(1, 6);
  $('upcoming').innerHTML = xs.map(x => eventRow(x, 'up')).join('')
    || '<div class="emptyState">그다음 일정이 없습니다.</div>';
  qsa('#upcoming .evRow[data-id]').forEach(n => n.onclick = () => edit(n.dataset.id));
}

/* ══ EventRow — 일정 하나를 그리는 유일한 함수 ══
 *  variant: 'up'  홈 그다음 일정 (trailing = D-day)
 *           'cal' 캘린더 월 목록 (날짜는 그룹 헤더에 있으므로 시간만)
 *  골격은 하나다. variant 는 trailing 에 무엇이 오는지만 정한다. */
function eventRow(x, variant, gmap) {
  const st = stageOf(x);
  const g = gmap ? gmap.get(appKey(x)) : null;
  const r = RESULTS[x.result] || RESULTS[''];
  const cert = isCert(x);
  // 회사명이 항상 같은 x 위치에서 시작해야 훑을 수 있다.
  // 그래서 앞자리는 폭이 고정된 점이고, 전형 이름은 부제로 내린다.
  const sub = variant === 'cal'
    ? `${esc(st.label)}${cert ? '' : ' · ' + esc(x.role)}${x.result ? ` · ${esc(r.label)}` : ''}`
    : `${esc(st.label)} · ${fmt(x)}`;
  let tail = '';
  if (variant === 'up') { const u = urgency(x); tail = `<span class="evTail ${u.cls}">${esc(u.text)}</span>`; }
  if (variant === 'cal') tail = `<span class="evTail">${x.time ? esc(x.time) : ''}</span>`;
  return `<button class="evRow ${isPast(x) ? 'is-past' : ''} ${
    g && (g.dropped || g.archived) ? 'is-dropped' : ''}" data-id="${esc(x.id)}">
    ${variant === 'cal' ? `<i class="evDot ${st.cls}" title="${esc(st.label)}"></i>` : ''}
    <span class="evMain">
      <span class="evTop">
        <span class="evCo">${esc(cert ? x.role : x.company)}</span>
        ${cert ? '' : `<span class="tierMark ${tierCls(x.tier)}">${esc(x.tier)}</span>`}
      </span>
      <span class="evSub">${sub}</span>
    </span>${tail}
  </button>`;
}

/* ── 캘린더 ── */
function renderCal() {
  $('calTitle').textContent = `${calYear}년 ${calMonth+1}월`;
  const gmap = new Map(groups().map(g => [g.key, g]));
  let h = ['월','화','수','목','금','토','일'].map(x => `<div class="dow">${x}</div>`).join('');
  const off  = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const last = new Date(calYear, calMonth+1, 0).getDate();
  const cells = [];
  for (let i=0;i<off;i++) cells.push(null);
  for (let i=1;i<=last;i++) cells.push(i);
  while (cells.length % 7) cells.push(null);

  const ts = todayStr();
  for (const day of cells) {
    if (!day) { h += '<div class="day empty"></div>'; continue; }
    const ds = `${calYear}-${pad2(calMonth+1)}-${pad2(day)}`;
    const items = events().filter(x => x.date === ds && !hiddenByArchive(x))
      .sort((a,b) => (a.time || '99').localeCompare(b.time || '99'));
    const shown = items.slice(0, 3);   // 월뷰는 «언제 몰려 있나» 만 본다
    h += `<button type="button" class="day ${ds === ts ? 'today' : ''} ${ds < ts ? 'gone' : ''}"
      data-day="${ds}" aria-label="${calYear}년 ${calMonth+1}월 ${day}일${
        items.length ? ` · 일정 ${items.length}건` : ''}">
      <div class="date">${day}</div>
      <div class="dots">${shown.map(x => {
        const st = stageOf(x), g = gmap.get(appKey(x));
        return `<i class="cdot ${st.cls} ${isPast(x) ? 'past' : ''} ${
          g && (g.dropped || g.archived) ? 'dropped' : ''}" title="${esc(st.label + ' · ' + x.company)}"></i>`;
      }).join('')}${items.length > 3 ? `<i class="cdotMore">+${items.length - 3}</i>` : ''}</div>
    </button>`;
  }
  $('calendar').innerHTML = h;
  renderCalList(gmap);
  qsa('.day[data-day]').forEach(d => d.onclick = () => gotoDay(d.dataset.day));
}

const DOW_KO = ['일','월','화','수','목','금','토'];

/** 월 격자 아래에 그 달 일정을 «항상» 펼쳐 둔다.
 *  격자만 보면 점이 뭔지 알 수 없다 — 누르지 않아도 보여야 한다. */
function renderCalList(gmap) {
  const ts = todayStr();
  const mp = `${calYear}-${pad2(calMonth+1)}-`;
  const xs = events()
    .filter(x => x.date.startsWith(mp) && !hiddenByArchive(x))
    .sort((a,b) => dObj(a.date, a.time) - dObj(b.date, b.time));

  if (!xs.length) {
    $('calList').innerHTML = `<div class="calEmpty">${calMonth+1}월에는 일정이 없습니다.</div>`;
    return;
  }

  const groupBy = list => {
    const m = new Map();
    list.forEach(x => { if (!m.has(x.date)) m.set(x.date, []); m.get(x.date).push(x); });
    return [...m.entries()];
  };
  const dayBlock = ([ds, items]) => {
    const d = dObj(ds);
    return `<div class="calDay${ds === ts ? ' isToday' : ''}" id="cd-${ds}">
      <div class="calDayH">${+ds.slice(5,7)}월 ${+ds.slice(8,10)}일<span>${
        DOW_KO[d.getDay()]}</span>${ds === ts ? '<em>오늘</em>' : ''}</div>
      ${items.map(x => eventRow(x, 'cal', gmap)).join('')}
    </div>`;
  };

  const past = xs.filter(x => x.date < ts);
  const rest = xs.filter(x => x.date >= ts);
  let h = `<div class="calListH">${calMonth+1}월 일정 ${xs.length}건</div>`;
  if (past.length) {
    // 지난 일정은 접어둔다. 없애지는 않는다 — 뭘 했는지 확인할 일이 있다.
    h += `<details class="pastFold"><summary>지난 일정 ${past.length}건</summary>${
      groupBy(past).map(dayBlock).join('')}</details>`;
  }
  h += groupBy(rest).map(dayBlock).join('');
  $('calList').innerHTML = h;
  qsa('#calList .evRow[data-id]').forEach(n => n.onclick = () => edit(n.dataset.id));
}

/** 격자에서 날짜를 누르면 아래 목록의 그날로 데려간다 (시트를 새로 열지 않는다) */
function gotoDay(ds) {
  const el = $('cd-' + ds);
  if (!el) {                       // 지난 일정이 접혀 있으면 펼치고 다시 찾는다
    const f = qs('#calList .pastFold');
    if (f && !f.open) { f.open = true; }
  }
  const t = $('cd-' + ds);
  if (!t) { toast('그날은 일정이 없습니다'); return; }
  t.scrollIntoView({ behavior:'smooth', block:'center' });
  t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
}

/* ── 지원 관리 ── */
/* ── 남은 시간 표기 (#17) — 같은 D-0 이라도 10:00 과 23:59 는 다르다 ── */
function urgency(x) {
  const ms = dObj(x.date, x.time || '23:59') - new Date();
  if (ms < 0) return { text:'지남', cls:'over' };
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (ms <= 6 * 3600000)  return { text: h ? `${h}시간 ${m}분 남음` : `${m}분 남음`, cls:'now' };
  if (ms <= 24 * 3600000) return { text: `${h}시간 남음`, cls:'soon' };
  return { text: dLabel(x), cls: days(x) <= 3 ? 'mild' : '' };   // 24시간 밖은 세게 칠하지 않는다
}

/** 목록 정렬 (#14): 결과 입력이 밀린 것 → 다음 일정 빠른 순 → 중요도 */
const TIER_RANK = { 'S+':0, 'S':1, 'A+':2, 'A':3, 'WATCH':4 };
function sortApps(list) {
  return list.sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    const ap = a.pending ? 0 : 1, bp = b.pending ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const an = a.next ? dObj(a.next.date, a.next.time) : Infinity;
    const bn = b.next ? dObj(b.next.date, b.next.time) : Infinity;
    if (an !== bn) return an - bn;
    return (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
  });
}

function filteredGroups(gs) {
  const q  = $('search').value.toLowerCase();
  const tf = $('tierFilter').value;
  const pf = $('pipeFilter').value;
  const pipe = PIPELINE.find(p => p.key === pf);
  return sortApps(gs.filter(g => !g.isCert)
    // 종료한 건은 «종료» 필터에서만 보인다 (검색으로는 찾을 수 있게 둔다)
    .filter(g => !g.archived || pf === '종료' || q)
    .filter(g => (!q || (g.company + ' ' + g.role).toLowerCase().includes(q))
              && (!tf || g.tier === tf)
              && (!pipe || inBucket(g, pipe))));
}

function renderPipeChips(gs) {
  const cur = $('pipeFilter').value;
  $('pipeChips').innerHTML = `<button class="chip2 ${cur ? '' : 'on'}" data-pc="">전체 <i>${
    gs.filter(g => !g.isCert).length}</i></button>` + PIPELINE.map(p => {
    const n = gs.filter(g => !g.isCert && inBucket(g, p)).length;
    return `<button class="chip2 ${cur === p.key ? 'on' : ''}" data-pc="${esc(p.key)}">${esc(p.key)} <i>${n}</i></button>`;
  }).join('');
  qsa('[data-pc]').forEach(b => b.onclick = () => {
    $('pipeFilter').value = b.dataset.pc;
    renderApps(groups()); renderFunnel(groups());
  });
}

function timelineHtml(g) {
  return `<div class="tl">${g.items.map(x => {
    const st = stageOf(x), past = isPast(x), r = RESULTS[x.result] || RESULTS[''];
    const mark = x.result === 'fail' ? 'r-fail'
               : (x.result === 'pass' || x.result === 'done') ? 'r-pass'
               : past ? 'r-need' : '';
    return `<span class="tlItem ${past ? 'done' : 'todo'} ${mark} ${st.cls}" data-id="${esc(x.id)}"
      title="${esc(st.label + ' · ' + r.label)}">${st.short} ${fmt(x)}${
      r.chip ? `<i class="rMark">${r.chip}</i>` : ''}</span>`;
  }).join('<span class="tlSep">›</span>')}</div>`;
}

function askResultHtml(g) {
  if (!g.pending || g.closed) return '';
  const x = g.pending, st = stageOf(x);
  // 마감이 지났는데 제출 여부가 없는 것과, 결과 발표가 지났는데 합·불이 없는 것을 구분한다
  const ask = x.stage === 'apply' ? '제출했나요?'
            : x.stage === 'result' ? '결과 나왔나요?'
            : x.stage === 'info' || x.stage === 'cert' ? '참석·완료했나요?' : '결과는?';
  return `<div class="askRes">
    <span><i class="askTag">결과 입력 필요</i>${fmt(x)} <b>${esc(st.label)}</b> ${ask}</span>
    <span class="askBtns">${resultOptions(x.stage).filter(Boolean).map(o =>
      `<button class="resBtn r-${o}" data-res="${esc(x.id)}" data-val="${o}">${RESULTS[o].label}</button>`
    ).join('')}</span></div>`;
}

function renderRadar(gs) {
  const order = { 'S+':0,'S':1,'A+':2,'A':3,'WATCH':4 };
  const xs = gs.filter(g => !g.isCert && !g.role.includes('채용설명회'))
    .sort((a,b) => (a.closed - b.closed) || ((order[a.tier] ?? 9) - (order[b.tier] ?? 9)));
  $('radar').innerHTML = xs.map(g => `
    <div class="jobRow ${impCls(g.tier, g.isCert)} ${isExcluded(g.override) ? 'excluded' : ''} ${g.dropped ? 'dropped' : ''}">
      <div class="jrTop">
        <div><div class="jrCo">${esc(g.company)}</div><div class="jrRo">${esc(g.role)}</div></div>
        <span class="tier ${tierCls(g.tier)}">${esc(g.tier)}</span>
      </div>
      <div class="jrMid">
        <span class="stBadge s-${g.status.replace(/[^가-힣]/g,'')}">${esc(g.status)}</span>
        ${g.next ? `<span class="stage ${stageOf(g.next).cls}">${stageOf(g.next).short} ${fmt(g.next)}</span>` : ''}
        ${goLink(g)}
      </div>
      ${g.override ? `<div class="override">현재 보정: ${esc(g.override.text)}</div>` : ''}
    </div>`).join('') || '<div class="empty">지원 건이 없습니다.</div>';
  bindGoLinks();
}

/* ── 목록 = 접힌 행. 자세한 건 상세 시트에서 본다 (#4 #12) ─────
 * 행에는 회사·직무·상태·다음 일정만.
 * 결과 입력이 밀린 건은 행 바로 아래에 입력 줄이 붙는다 — 이게 주 액션이다. */
function renderApps(gs) {
  const xs = filteredGroups(gs);
  $('appCards').innerHTML = xs.map(g => {
    const u = g.next ? urgency(g.next) : null;
    // 상태는 StatusChip 하나로만 말한다. 그 옆은 «다음에 뭘 하나» 전용.
    const chip = g.archived
      ? { cls:'is-fail', txt: g.status === '지원예정' ? '지원 안 함' : '종료' }
      : g.closed ? (g.won ? { cls:'is-done', txt:'최종합격' } : { cls:'is-fail', txt:'불합격' })
      : g.hold   ? { cls:'is-hold', txt:'보류' }
      : { cls: g.status === '지원예정' ? '' : 'is-live', txt: g.status };
    const next = (!g.closed && !g.archived && g.next)
      ? `<span class="acNext">${esc(stageOf(g.next).label)} ${fmt(g.next)}</span>` : '';
    const dd = (u && !g.closed && !g.hold && !g.archived)
      ? `<b class="acDd ${u.cls}">${esc(u.text)}</b>` : '';
    return `<div class="appCard ${impCls(g.tier, g.isCert)} ${
      (g.dropped || g.archived) ? 'is-dropped' : ''}">
      <button class="acHit" data-open="${esc(g.key)}">
        <span class="acTop">
          <span class="acCo">${esc(g.company)}</span>
          <span class="tierMark ${tierCls(g.tier)}">${esc(g.tier)}</span>
        </span>
        <span class="acRole">${esc(g.role)}</span>
        <span class="acMeta">
          <span class="statusChip ${chip.cls}">${esc(chip.txt)}</span>${next}${dd}
        </span>
      </button>
      ${askResultHtml(g)}
      ${g.waitDays >= STALE_DAYS ? `<div class="acStale">서류 결과 대기 ${g.waitDays}일 · 확인 필요</div>` : ''}
    </div>`;
  }).join('') || (events().length
    ? '<div class="emptyState">조건에 맞는 지원 건이 없습니다.</div>'
    : `<div class="emptyState"><b>지원 건이 없습니다</b><br><b>새 공고</b>에서 자동으로 찾아온 후보를 확인하거나 오른쪽 위 + 로 직접 추가하세요.</div>`);

  qsa('[data-res]').forEach(b => b.onclick = e => { e.stopPropagation(); setResult(b.dataset.res, b.dataset.val); });
  qsa('[data-open]').forEach(b => b.onclick = () => openApp(b.dataset.open));
  $('filterReset').hidden = !($('search').value || $('tierFilter').value || $('pipeFilter').value);
  renderPipeChips(gs);
}

/* ── 상세 시트 — 타임라인·메모·부가 액션은 전부 여기로 ──────── */
let openAppKey = null;
/** 세로 stepper. 결과가 필요한 단계는 그 자리에서 바로 입력한다.
 *  (상세 위쪽에 같은 입력 줄을 또 두면 한 화면에 두 번 나온다) */
function stepperHtml(g) {
  const needId = g.pending ? g.pending.id : null;
  return `<ol class="stp">${g.items.map(x => {
    const st = stageOf(x), past = isPast(x), r = RESULTS[x.result] || RESULTS[''];
    const cls = x.result === 'fail' ? 'sFail'
              : (x.result === 'pass' || x.result === 'done') ? 'sPass'
              : past ? 'sNeed' : 'sTodo';
    const ask = x.id === needId
      ? `<span class="stpAsk">${resultOptions(x.stage).filter(Boolean).map(v =>
          `<button class="resBtn r-${v}" data-res="${esc(x.id)}" data-val="${v}">${RESULTS[v].label}</button>`).join('')}</span>`
      : '';
    return `<li class="${cls}">
      <button class="stpBtn" data-edit="${esc(x.id)}">
        <span class="stpDot"></span>
        <span class="stpBody">
          <span class="stpT">${esc(st.label)}</span>
          <span class="stpD">${fmt(x)}${x.result ? ` · ${esc(r.label)}` : (past ? ' · 결과 미입력' : '')}</span>
        </span>
      </button>${ask}
    </li>`;
  }).join('')}</ol>`;
}
function openApp(key) {
  const g = groups().find(v => v.key === key); if (!g) return;
  openAppKey = key;
  $('apTitle').textContent = g.company;
  $('apSub').textContent = g.role;
  $('apBody').innerHTML = `
    <div class="apHead">
      <span class="tier ${tierCls(g.tier)}">${esc(g.tier)}</span>
      <span class="stBadge s-${g.status.replace(/[^가-힣]/g,'')}">${esc(g.status)}</span>
      ${g.archived ? '<span class="stBadge s종료">종료</span>' : (g.hold ? '<span class="stBadge s보류">보류</span>' : '')}
      ${goLink(g, '채용 페이지 ↗')}
      <button class="apEditBtn" id="apEdit">수정</button>
    </div>
    <h4 class="apH4">전형 진행 <i>${g.items.filter(i => i.result).length}/${g.items.length} 완료</i></h4>
    ${stepperHtml(g)}
    ${g.english ? `<div class="apSec"><b>영어·자격 ${eligBadge(g.english)}</b><p>${esc(g.english)}</p>
      <p class="egWhy">${esc(evaluateEligibility(g.english, quals()).reason)}</p></div>` : ''}
    ${g.note ? `<div class="apSec"><b>메모</b><p>${esc(g.note)}</p></div>` : ''}
    ${g.override ? `<div class="apSec"><b>보정 규칙</b><p>${esc(g.override.text)}</p></div>` : ''}`;
  $('apHold').textContent = g.hold ? '보류 해제' : '보류하기';
  $('apHold').hidden = g.archived;                       // 종료가 최상위 overlay — 보류는 가린다
  // 지원 전이면 «종료» 가 아니라 «지원 안 함» 이 맞는 말이다.
  // 데이터는 똑같이 archive 이고 되돌릴 수 있다 — 말만 상태에 맞춘다.
  const notYet = g.status === '지원예정';
  $('apArchive').textContent = g.archived ? (notYet ? '다시 지원 후보로' : '종료 취소')
                                          : (notYet ? '지원 안 함' : '지원 종료');
  $('apArchive').classList.toggle('btnPrimary', g.archived);
  $('apMoreMenu').hidden = true;
  // 이미 다음 전형이 잡혀 있으면 «전형 추가» 가 최우선 행동이 아니다
  $('apAddStage').className = 'btn full ' + ((!g.next && !g.closed) ? 'btnPrimary' : 'btnGhost');
  $('apAddStage').hidden = g.archived;
  openSheet('apBg');
  qsa('#apBody [data-res]').forEach(b => b.onclick = () => setResult(b.dataset.res, b.dataset.val));
  qsa('#apBody [data-edit]').forEach(b => b.onclick = () => { closeSheet('apBg'); edit(b.dataset.edit); });
  $('apEdit').onclick = () => openAppEdit(key);
  bindGoLinks();
}
/* ═══════════ 지원 정보 수정 (v8.1.5) ═══════════
 *  key 가 company|role 이라서, 이름을 바꾸면 파생 참조가 전부 따라가야 한다.
 *  archived · ignoredOut · outProposals — 하나라도 빠지면 종료 상태나 무시 기록이 조용히 사라진다. */
let edKey = null;
function openAppEdit(key) {
  const g = groups().find(v => v.key === key); if (!g) return;
  edKey = key;
  $('edCompany').value = g.company; $('edRole').value = g.role; $('edTier').value = g.tier;
  $('edWarn').hidden = true;
  closeSheet('apBg');
  openSheet('edBg');
}
const cancelAppEdit = () => {
  const key = edKey; closeSheet('edBg'); edKey = null;
  if (key) openApp(key);
};
$('edClose').onclick = $('edCancel').onclick = cancelAppEdit;
$('edSave').onclick = () => {
  const g = groups().find(v => v.key === edKey); if (!g) return;
  const co = $('edCompany').value.trim(), ro = $('edRole').value.trim();
  if (!co || !ro) { $('edWarn').hidden = false; $('edWarn').textContent = '회사와 직무는 비울 수 없습니다.'; return; }
  const newKey = `${co}|${ro}`;
  if (newKey !== edKey && groups().some(v => v.key === newKey)) {
    $('edWarn').hidden = false;
    $('edWarn').textContent = '같은 회사·직무의 지원 건이 이미 있습니다. 둘을 합치지는 않습니다 — 다른 이름을 쓰세요.';
    return;
  }
  const oldKey = edKey, tier = $('edTier').value;
  const before = { items: g.items.map(x => ({ id:x.id, company:x.company, role:x.role, tier:x.tier })),
                   arch: archMap()[oldKey] ? { ...archMap()[oldKey] } : null,
                   ign: (state.ignoredOut || {})[oldKey] ? { ...state.ignoredOut[oldKey] } : null };
  // 1) 일정 전부를 새 이름으로
  events().forEach(x => { if (appKey(x) === oldKey) { x.company = co; x.role = ro; x.tier = tier; } });
  // 2) 파생 참조 이관
  if (newKey !== oldKey) {
    const am = archMap();
    if (am[oldKey]) { am[newKey] = am[oldKey]; delete am[oldKey]; }
    const ign = (state.ignoredOut = state.ignoredOut || {});
    if (ign[oldKey]) { ign[newKey] = ign[oldKey]; delete ign[oldKey]; }
    (state.outProposals || []).forEach(o => { if (o.key === oldKey) { o.key = newKey; o.company = co; o.role = ro; } });
  }
  save(); closeSheet('edBg'); edKey = null;
  openApp(newKey);
  undoBar('지원 정보를 바꿨습니다', () => {
    const m = new Map(before.items.map(v => [v.id, v]));
    events().forEach(x => { const v = m.get(x.id); if (v) { x.company = v.company; x.role = v.role; x.tier = v.tier; } });
    const am = archMap(); delete am[newKey]; if (before.arch) am[oldKey] = before.arch;
    const ign = (state.ignoredOut = state.ignoredOut || {});
    delete ign[newKey]; if (before.ign) ign[oldKey] = before.ign;
    (state.outProposals || []).forEach(o => { if (o.key === newKey) {
      o.key = oldKey; o.company = before.items[0].company; o.role = before.items[0].role; } });
    save(); openApp(oldKey);
  });
};

$('apClose').onclick = () => { closeSheet('apBg'); openAppKey = null; };
$('apAddStage').onclick = () => { const k = openAppKey; closeSheet('apBg'); if (k) addStage(k); };
$('apHold').onclick = () => { if (openAppKey) { toggleHold(openAppKey); openApp(openAppKey); } };
$('apMore').onclick = () => { $('apMoreMenu').hidden = !$('apMoreMenu').hidden; };
$('apArchive').onclick = () => {
  const k = openAppKey; if (!k) return;
  const on = !isArchived(k);
  archiveApp(k, on);
  if (on) {
    const g0 = groups().find(v => v.key === k);
    const word = g0 && g0.status === '지원예정' ? '지원하지 않기로 했습니다' : '지원을 종료했습니다';
    closeSheet('apBg'); openAppKey = null;
    undoBar(`${k.split('|')[0]} ${word}`, () => archiveApp(k, false));
  } else { openApp(k); toast('되돌렸습니다'); }
};
$('apDelete').onclick = () => {
  const k = openAppKey; if (!k) return;
  const g = groups().find(v => v.key === k);
  if (!confirm(`${k.split('|')[0]} 지원 기록을 완전히 삭제합니다.\n일정 ${g ? g.items.length : 0}건이 사라지고, 통계에서도 빠집니다.\n\n«지원 종료» 는 기록을 남기면서 목록에서만 치웁니다. 그래도 삭제할까요?`)) return;
  const backup = { items: (g ? g.items.map(x => ({ ...x })) : []), arch: archMap()[k] ? { ...archMap()[k] } : null };
  closeSheet('apBg'); openAppKey = null;
  state.events = events().filter(x => appKey(x) !== k);
  delete archMap()[k];
  save();
  undoBar(`${k.split('|')[0]} 기록을 삭제했습니다`, () => {
    state.events = [...events(), ...backup.items];
    if (backup.arch) archMap()[k] = backup.arch;
    save();
  });
};

/* ── 되돌리기 스낵바 (5초) ───────────────────────────────── */
let undoTimer;
function undoBar(msg, onUndo) {
  const el = $('undoBar'); if (!el) { toast(msg); return; }
  el.innerHTML = `<span>${esc(msg)}</span><button id="undoBtn">되돌리기</button>`;
  el.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { el.hidden = true; }, 5000);
  $('undoBtn').onclick = () => { clearTimeout(undoTimer); el.hidden = true; onUndo(); toast('되돌렸습니다'); };
}

/* ── 새 공고 검토함 ── */
function renderOutProposals() {
  const ps = (state.outProposals = Array.isArray(state.outProposals) ? state.outProposals : []);
  const box = $('outProposals');
  if (!box) return;
  if (!ps.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="opBox">
    <div class="opHead"><b>종료 제안 ${ps.length}건</b>
      <span>레이더가 «이제 빼도 된다» 고 본 건입니다. 승인해야 실제로 종료됩니다.</span></div>
    ${ps.map((o, i) => `<div class="opRow">
      <div class="opMain"><div class="opCo">${esc(o.company)}</div>
        <div class="opRole">${esc(o.role)}${o.reason ? ` · ${esc(o.reason)}` : ''}</div></div>
      <div class="opBtns">
        <button class="btn btnGhost sm" data-opskip="${i}">무시</button>
        <button class="btn btnPrimary sm" data-opok="${i}">종료</button>
      </div></div>`).join('')}
    <button class="btn btnGhost full" id="opAll">${ps.length}건 전부 종료</button>
  </div>`;
  const drop = i => { const o = ps[i]; ps.splice(i, 1); return o; };
  qsa('[data-opok]').forEach(b => b.onclick = () => {
    const o = drop(+b.dataset.opok); archiveApp(o.key, true); save(); render();
    undoBar(`${o.company} 종료`, () => { archiveApp(o.key, false); ps.push(o); save(); render(); });
  });
  qsa('[data-opskip]').forEach(b => b.onclick = () => {
    const o = drop(+b.dataset.opskip);
    const g = groups().find(x => x.key === o.key);
    const ign = (state.ignoredOut = state.ignoredOut || {});
    if (g) ign[o.key] = { basis: outBasis(g), at: Date.now() };
    save(); render();
    undoBar(`${o.company} 제안 무시`, () => {
      delete (state.ignoredOut || {})[o.key]; ps.push(o); save(); render(); });
  });
  $('opAll').onclick = () => {
    const copy = ps.slice(); copy.forEach(o => archiveApp(o.key, true));
    ps.length = 0; save(); render();
    undoBar(`${copy.length}건 종료`, () => {
      copy.forEach(o => { archiveApp(o.key, false); ps.push(o); }); save(); render(); });
  };
}

function renderInbox() {
  renderOutProposals();
  const xs = [...(state.inbox || [])].sort((a,b) => a.schedule[0].date.localeCompare(b.schedule[0].date));
  const n = xs.length;
  const op = (state.outProposals || []).length;
  const badge = n + op;
  $('tabBadge').textContent = badge > 9 ? '9+' : (badge || '');
  $('tabBadge').hidden = !badge;
  renderAutoRadarStatus();
  const bar = $('inboxAlert');
  bar.hidden = !n;
  if (n) {
    bar.innerHTML = `<span>새 공고 ${n}건이 검토를 기다립니다</span><button id="goInbox">보러 가기</button>`;
    $('goInbox').onclick = () => go('inbox');
  }

  $('inboxList').innerHTML = xs.map(x => {
    const ov = overrideFor(x.company, x.role);
    return `<div class="inCard">
      <div class="inTop">
        <div><div class="inCo">${esc(x.company)} ${goLink(x)}${
          x.unverified ? '<span class="unv">미검증</span>' : ''}</div><div class="inRole">${esc(x.role)}</div></div>
        <span class="tier ${tierCls(x.tier)}">${esc(x.tier)}</span>
      </div>
      ${x.unverified ? `<div class="inNote inUnv">공식 채용 페이지 링크가 확인되지 않았습니다 — 캘린더에 넣기 전에 직접 확인하세요</div>` : ''}
      ${x.note ? `<div class="inNote">${esc(x.note)}</div>` : ''}
      ${x.jd ? `<div class="inSec"><b>주요 업무</b><p>${esc(x.jd)}</p></div>` : ''}
      ${x.require ? `<div class="inSec"><b>자격 요건</b><p>${esc(x.require)}</p></div>` : ''}
      ${x.english ? `<div class="inSec"><b>영어·자격 ${eligBadge(x.english)}</b><p>${esc(x.english)}</p>
        <p class="egWhy">${esc(evaluateEligibility(x.english, quals()).reason)}</p></div>` : ''}
      <div class="inSec"><b>전형 일정</b>
        <div class="inSch">${x.schedule.map((e,i) => {
          const st = STAGES.find(s => s.key === e.stage) || STAGES[2];
          return `<button class="schChip ${st.cls} ${e.on ? 'on' : 'off'}" data-sch="${esc(x.id)}" data-i="${i}">${
            st.short} ${e.date.slice(5).replace('-','/')}${e.time ? ' ' + e.time : ''}</button>`;
        }).join('')}</div>
        <div class="schHint">넣고 싶지 않은 일정은 눌러서 끄세요</div>
      </div>
      ${ov ? `<div class="override">현재 보정: ${esc(ov.text)}</div>` : ''}
      <div class="inBtns">
        <button class="btn btnGhost" data-drop="${esc(x.id)}">이 회사·직무 제외</button>
        <button class="btn btnPrimary" data-accept="${esc(x.id)}">지원 Radar에 추가</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty">검토할 새 공고가 없습니다.<br>채용 레이더가 새 후보를 자동으로 확인합니다.</div>`;

  qsa('[data-sch]').forEach(b => b.onclick = () => {
    const it = state.inbox.find(v => v.id === b.dataset.sch); if (!it) return;
    it.schedule[+b.dataset.i].on = !it.schedule[+b.dataset.i].on; save();
  });
  qsa('[data-accept]').forEach(b => b.onclick = () => acceptInbox(b.dataset.accept));
  qsa('[data-drop]').forEach(b => b.onclick = () => dropInbox(b.dataset.drop));
  bindGoLinks();
}

function renderAutoRadarStatus() {
  const el=$('radarStatus'); if(!el) return;
  const m=state.radarMeta||{}, needsRetry=['failed','unknown'].includes(m.feedStatus);
  el.classList.toggle('is-error',m.feedStatus==='failed');
  el.classList.toggle('is-partial',m.feedStatus!=='failed'&&['partial','unknown'].includes(m.feedCoverage));
  el.onclick=needsRetry?()=>fetchRadarFeed({force:true}):null;
  el.setAttribute('role',needsRetry?'button':'status');
  if(m.feedStatus==='failed') { el.innerHTML='<b>채용 레이더 갱신 실패</b><span>눌러서 다시 확인</span>'; return; }
  if(m.feedStatus==='unknown') { el.innerHTML='<b>채용 레이더 상태 확인 필요</b><span>눌러서 다시 확인</span>'; return; }
  if(m.feedStatus==='running') { el.innerHTML='<b>채용 레이더 확인 중</b><span>새 공고를 확인하고 있습니다</span>'; return; }
  if(!m.lastFeedAt) { el.innerHTML='<b>채용 레이더 확인 중</b><span>기기간 동기화와 별도입니다</span>'; return; }
  const at=new Date(m.lastFeedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  const waiting=(state.inbox||[]).length;
  const stale=Date.now()-new Date(m.lastFeedAt).getTime()>36*60*60*1000;
  if(stale) { el.innerHTML=`<b>채용 레이더 · 업데이트 필요</b><span>마지막 실행 ${esc(at)} · 눌러서 다시 확인</span>`; el.onclick=()=>fetchRadarFeed({force:true}); el.setAttribute('role','button'); return; }
  if(m.feedCoverage==='partial') {
    el.innerHTML=`<b>채용 레이더 · 업데이트됨</b><span>${esc(at)} · 일부 사이트 확인 지연 · ${waiting ? `검토 대기 ${waiting}건` : '검토 대기 없음'}</span>`;
    return;
  }
  el.innerHTML=`<b>채용 레이더 · 최신</b><span>${esc(at)} · ${waiting ? `검토 대기 ${waiting}건` : '검토 대기 없음'}</span>`;
}

// Automated tests and localhost builds fail closed: they can only use the local
// fixture server. Production Supabase is contacted only by the deployed app.
const IS_LOCAL_FEED=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const AUTO_FEED_URL=IS_LOCAL_FEED?'http://127.0.0.1:8878/rest/v1/':PRODUCTION_SYNC_URL+'/rest/v1/';
function feedRoleMatch(role) {
  const jobs=(profile().jobs||[]).filter(Boolean); if(!jobs.length) return true;
  const clusters={
    '사업기획':['사업기획','전략기획','경영기획','경영일반','사업관리','business planning','business strategy'],'전략기획':['전략기획','사업기획','경영기획','경영일반','strategy','strategic planning'],
    '사업개발':['사업개발','신사업','수주영업','b2b 영업','부동산 개발','부동산개발','점포개발','리징','상업공간기획','business development','business partnership','partnership'],'영업기획':['영업기획','영업전략','영업/마케팅','b2b 영업','b2c 영업','sales planning','sales strategy'],
    '영업관리':['영업관리','채널관리','수주영업'],'상품기획':['상품기획','제품/서비스 마케팅','식음기획','서비스 기획'],
    '마케팅':['마케팅','브랜드','ae','marketing','growth'],'브랜드마케팅':['브랜드','마케팅전략','brand marketing'],'서비스기획':['서비스 기획','it 서비스 기획','service planning'],
    'PM·PO':['서비스 기획','상품기획','pm','po'],'해외영업':['해외영업','영업'],'컨설팅':['컨설팅'],
    'R&D·연구개발':['r&d','연구개발','연구/개발','회로설계','신호및시스템설계','공정기술','공정설계','제품개발','재료개발','기구개발','평가및분석','sw개발','소프트웨어','인공지능','애플리케이션 개발'],
    'SW개발':['sw개발','소프트웨어','시스템 소프트웨어','애플리케이션 개발','인공지능','ai'],
    'HW·회로설계':['hw','하드웨어','회로설계','신호및시스템설계','기구개발'],
    '생산·공정기술':['생산','공정기술','공정설계','제조기술','설비기술'],'품질':['품질','품질관리','품질보증','평가및분석'],
    '디자인':['디자인','ux','ui','비주얼'],'법무':['법무','컴플라이언스'],'HR':['인사','hr','채용','인재개발'],
    '재무·회계':['재무','회계','세무'],'데이터분석':['데이터','data','분석'],'SCM·물류':['scm','물류','구매','공급망'],
    '상권·점포·공간기획':['상권','점포개발','점포기획','공간기획','상업공간','리징','브랜드md','부동산 개발','부동산개발','입지','가맹개발','프랜차이즈']};
  const r=String(role||'').toLowerCase();
  return jobs.some(j=>{
    const raw=String(j), jl=raw.toLowerCase();
    const isRnd=/r\s*&\s*d|연구|research|기술[\s·/_-]*개발|제품[\s·/_-]*개발/i.test(raw);
    if(isRnd){
      const rnd=/r\s*&\s*d|연구|제품[\s·/_-]*개발|기술[\s·/_-]*개발|설계|공정|회로|반도체|품질|평가|분석|실험|시험|소재|재료|기구|자동화|인공지능|\bai\b|\bnlp\b|\bsw\b|소프트웨어|애플리케이션|데이터[\s·/_-]*분석|인프라|\bsi\b/i;
      const hardNonRnd=/영업|사업개발|상품개발|호텔|푸드|계리|데이터센터|오피스빌딩|생산설비|건축|토목|주택|시공|조달|안전/i;
      const nonRnd=/영업|마케팅|재무|회계|인사|경영지원|사업기획|사업관리|사업개발|상품기획|상품개발|서비스\s*기획|서비스엔지니어|호텔|푸드|계리|건축|토목|주택|시공|조달|안전/i;
      const strongRnd=/r\s*&\s*d|연구|제품[\s·/_-]*개발|기술[\s·/_-]*개발|공정|회로|반도체|평가|분석|실험|시험|소재|재료|기구|자동화|인공지능|\bai\b|\bnlp\b|\bsw\b|소프트웨어|애플리케이션/i;
      if(hardNonRnd.test(r)&&!/r\s*&\s*d|연구/i.test(r)) return false;
      return rnd.test(r)&&(!nonRnd.test(r)||strongRnd.test(r));
    }
    let keys=clusters[raw]||[raw];
    if(/상권|점포|공간|프랜차이즈|리징|부동산/i.test(raw)) keys=clusters['상권·점포·공간기획'];
    else if(/소프트웨어|sw\s*개발/i.test(raw)) keys=clusters['SW개발'];
    else if(/하드웨어|hw|회로/i.test(raw)) keys=clusters['HW·회로설계'];
    return keys.some(k=>r.includes(String(k).toLowerCase()))||r.includes(jl);
  });
}
let feedBusy=false;
async function fetchRadarFeed({force=false}={}) {
  if(feedBusy||!navigator.onLine||location.protocol==='file:') return;
  const m=state.radarMeta||{}; if(!force&&m.lastFeedCheckAt&&Date.now()-m.lastFeedCheckAt<15*60*1000) return;
  feedBusy=true;
  const headers={apikey:DEFAULT_SYNC_KEY,Authorization:'Bearer '+DEFAULT_SYNC_KEY};
  try {
    const feedFetchOptions={headers,cache:'no-store'};
    const [ir,sr]=await Promise.all([
      fetch(AUTO_FEED_URL+'radar_feed_items?select=feed_key,company,role,deadline,official_url,payload,published_at,active&order=published_at.desc&limit=1000',feedFetchOptions),
      fetch(AUTO_FEED_URL+'radar_feed_status?select=status,completed_at,candidate_count,checked_company_count&id=eq.latest',feedFetchOptions)]);
    if(!ir.ok||!sr.ok) throw new Error('feed-http');
    const allRows=await ir.json(), statusRows=await sr.json(), status=Array.isArray(statusRows)?statusRows[0]:null;
    if(!Array.isArray(allRows)) throw new Error('feed-shape');
    state.radarSeen=(state.radarSeen&&typeof state.radarSeen==='object')?state.radarSeen:{};
    state.radarIdentity=(state.radarIdentity&&typeof state.radarIdentity==='object')?state.radarIdentity:{};
    const today=todayStr(), inactive=new Set(allRows.filter(r=>r.active===false).map(r=>r.feed_key));
    // 수동 가져오기 항목은 건드리지 않는다. 자동 feed 후보만 명시적 종료/마감 때 정리한다.
    state.inbox=(state.inbox||[]).filter(x=>{
      if(!x.feedKey) return true;
      if(inactive.has(x.feedKey)) return false;
      const apply=(x.schedule||[]).find(e=>e.stage==='apply');
      return !apply||apply.date>=today;
    });
    const rows=allRows.filter(r=>r.active!==false&&(!r.deadline||String(r.deadline).slice(0,10)>=today));
    const existing=new Set([...(state.inbox||[]),...events()].map(x=>`${x.company}|${x.role}`));
    const dropped=new Set(state.dismissed||[]); let added=0;
    for(const row of rows) {
      const matchText=[row.role,row.payload&&row.payload.match_terms].filter(Boolean).join(' ');
      if(!feedRoleMatch(matchText)||state.radarSeen[row.feed_key]) continue;
      const base=`${row.company}|${row.role}`, identity=`${base}|${row.official_url}`;
      const previous=state.radarIdentity[identity];
      state.radarSeen[row.feed_key]=row.published_at||Date.now(); state.radarIdentity[identity]=row.feed_key;
      const x=normalizeInbox(row.payload||{}); if(!x) continue;
      if(importBlocked(x)||dropped.has(base)) continue;
      if(existing.has(base)&&!previous) continue;
      x.feedKey=row.feed_key;
      if(previous&&previous!==row.feed_key) {
        x.note='[공고 변경] '+(x.note||'마감일 또는 공고 내용이 바뀌었습니다');
        x.updateCandidate=true; x.feedIdentity=identity;
        const old=(state.inbox||[]).findIndex(v=>v.company===x.company&&v.role===x.role&&v.feedKey);
        if(old>=0) { x.id=state.inbox[old].id; state.inbox[old]=x; }
        else state.inbox.push(x);
      } else state.inbox.push(x);
      existing.add(base); added++;
    }
    const checkedCompanies=Number(status&&status.checked_company_count)||0;
    const rawStatus=status&&String(status.status||'').toLowerCase();
    const feedStatus=['ok','failed','running'].includes(rawStatus)?rawStatus:'unknown';
    const completedAt=status&&status.completed_at&&Number.isFinite(Date.parse(status.completed_at))?status.completed_at:(m.lastFeedAt||0);
    state.radarMeta={...m,feedStatus,feedCoverage:checkedCompanies<=0?'unknown':checkedCompanies<50?'partial':'complete',lastFeedCheckAt:Date.now(),lastFeedReceivedAt:Date.now(),lastFeedAt:completedAt,feedNewCount:added,feedCandidateCount:Number(status&&status.candidate_count)||rows.length,feedCheckedCompanies:checkedCompanies};
    save(); if(added) toast(`채용 레이더 · 새 후보 ${added}건`);
  } catch(e) {
    state.radarMeta={...m,feedStatus:'failed',lastFeedCheckAt:Date.now()}; save(false);
  } finally { feedBusy=false; }
}

function acceptInbox(id) {
  const x = (state.inbox || []).find(v => v.id === id); if (!x) return;
  const picked = x.schedule.filter(e => e.on);
  if (!picked.length) { toast('넣을 일정을 하나 이상 켜주세요'); return; }
  const note = [x.note, x.jd, x.require].filter(Boolean).join(' · ');
  let updated=0, created=0;
  picked.forEach((e,i) => {
    const current=x.updateCandidate&&events().find(v=>appKey(v)===`${x.company}|${x.role}`&&v.stage===e.stage);
    if(current) {
      Object.assign(current,{date:e.date,time:e.time,tier:x.tier,english:x.english||current.english||'',note:note||current.note||'',url:x.url||current.url||''});
      updated++; return;
    }
    state.events.push({id:'ev-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,6),company:x.company,role:x.role,tier:x.tier,status:'',date:e.date,time:e.time,stage:e.stage,kind:e.stage==='apply'?'deadline':e.stage==='open'?'open':(e.stage==='info'||e.stage==='cert')?'event':'process',result:'',hold:false,progress:0,english:x.english||'',note,url:x.url||''});
    created++;
  });
  state.inbox = state.inbox.filter(v => v.id !== id);
  save(); toast(updated?`${x.company} · 일정 ${updated}건을 업데이트했습니다`:`${x.company} · ${created}건을 캘린더에 넣었습니다`);
}
function dropInbox(id) {
  const x = (state.inbox || []).find(v => v.id === id); if (!x) return;
  state.dismissed = [...new Set([...(state.dismissed || []), `${x.company}|${x.role}`])];
  state.inbox = state.inbox.filter(v => v.id !== id);
  save(); toast(`${x.company} 제외 · 다음부터 자동으로 걸러집니다`);
}
$('clearDropBtn').onclick = () => {
  const n = (state.dismissed || []).length;
  if (!n) { toast('제외 목록이 비어 있습니다'); return; }
  if (confirm(`제외해둔 ${n}건을 초기화할까요?`)) { state.dismissed = []; save(); toast('제외 목록을 비웠습니다'); }
};

/* ── 퍼스널 DB ── */
const openAxes = new Set();
function renderDB() {
  const dbPath = $('dbPath');
  if (!dbPath.dataset.ready) {
    [...new Set(PDB.map(x => x.path))].sort().forEach(v => {
      const o = document.createElement('option'); o.textContent = v; o.value = v; dbPath.appendChild(o);
    });
    dbPath.dataset.ready = '1';
  }
  const q = ($('dbSearch').value || '').trim().toLowerCase();
  const st = $('dbStage').value, pa = dbPath.value, sort = $('dbSort').value, excl = $('dbExcl').value;
  const activeNames = events().map(x => x.company);

  let xs = PDB.filter(x =>
    (!q || (x.company + ' ' + x.role + ' ' + x.path).toLowerCase().includes(q)) &&
    (!st || x.stage === st) && (!pa || x.path === pa))
    .map(x => { const rule = overrideFor(x.company, x.role);
      return { ...x, rule, excluded: isExcluded(rule), my: axesScore(x.company) }; });

  if (excl === 'hide') xs = xs.filter(x => !x.excluded);
  if (sort === 'company')   xs.sort((a,b) => a.company.localeCompare(b.company,'ko'));
  else if (sort === 'rank') xs.sort((a,b) => a.rank - b.rank);
  else if (sort === 'axes') xs.sort((a,b) => (b.my ?? -1) - (a.my ?? -1) || b.score - a.score);
  else                      xs.sort((a,b) => (a.excluded - b.excluded) || b.score - a.score);

  $('dbList').innerHTML = xs.map(x => {
    const match = activeNames.some(n => n.includes(x.company) || x.company.includes(n));
    const ben = x.rule && x.rule.kind === 'BEN';
    const a = axesOf(x.company) || {};
    return `<div class="dbRow ${x.excluded ? 'excluded' : ''}">
      <div class="dbTop">
        <div>
          <div class="dbRank">#${x.rank} · ${esc(x.stage)}</div>
          <div class="dbCo">${esc(x.company)}</div>
          <div class="dbMeta">${esc(x.path)} · 실행우선 ${x.score}${x.my !== null ? ` · 내 평가 ${x.my}` : ''}</div>
        </div>
        <span class="chip ${ben ? 'ben' : match ? 'activeMatch' : ''}">${
          ben ? 'BEN' : x.excluded ? '제외' : match ? 'ACTIVE' : x.absolute + '/' + x.industry}</span>
      </div>
      <div class="dbRole">${esc(x.role)}</div>
      <div class="dbChips">
        <span class="chip">절대 ${esc(x.absolute)}</span>
        <span class="chip">산업 ${esc(x.industry)}</span>
        ${safeUrl(x.url) ? `<a class="chip golink" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">사이트 ↗</a>` : ''}
      </div>
      ${x.rule ? `<div class="override">현재 보정: ${esc(x.rule.text)}</div>` : ''}
      <button class="axesToggle" data-ax-toggle="${esc(x.company)}">평가축 ${
        x.my !== null ? `· 종합 ${x.my}` : '입력'} ▾</button>
      <div class="axes" data-ax-panel="${esc(x.company)}">
        ${myAxes().map(ax => `<div class="axRow"><span>${ax.label}</span><div class="axDots">${
          [1,2,3,4,5].map(n => `<button class="axDot ${(a[ax.key]||0) >= n ? 'on' : ''}"
            data-ax-set="${esc(x.company)}" data-ax-key="${ax.key}" data-ax-val="${n}"
            aria-label="${ax.label} ${n}점"></button>`).join('')}</div></div>`).join('')}
        <div class="axTotal">${x.my !== null
          ? `종합 ${x.my} <em>· 내 가중치 반영</em>`
          : '<em>아직 채점하지 않음 — 점을 눌러 0~5로 평가</em>'}</div>
      </div>
    </div>`;
  }).join('') || '<div class="empty">조건에 맞는 기업이 없습니다.</div>';

  qsa('[data-ax-toggle]').forEach(b => b.onclick = () => {
    const p = qs(`[data-ax-panel="${CSS.escape(b.dataset.axToggle)}"]`);
    if (p) p.classList.toggle('open');
  });
  qsa('[data-ax-set]').forEach(b => b.onclick = () => {
    openAxes.add(b.dataset.axSet);
    setAxis(b.dataset.axSet, b.dataset.axKey, +b.dataset.axVal);
  });
  openAxes.forEach(c => { const p = qs(`[data-ax-panel="${CSS.escape(c)}"]`); if (p) p.classList.add('open'); });
  bindGoLinks();
}

/* ═══════════ 필터 / 월 이동 ═══════════ */
['search','tierFilter'].forEach(id => {
  const on = () => { $('searchClear').hidden = !$('search').value; renderApps(groups()); };
  $(id).oninput = on; $(id).onchange = on;
});
$('searchClear').onclick = () => {
  $('search').value = ''; $('searchClear').hidden = true; renderApps(groups());
};
$('filterReset').onclick = () => {
  $('search').value = ''; $('tierFilter').value = '';
  $('pipeFilter').value = ''; $('searchClear').hidden = true;
  renderApps(groups()); renderFunnel(groups()); toast('필터를 초기화했습니다');
};
['dbSearch','dbStage','dbPath','dbSort','dbExcl'].forEach(id => {
  $(id).oninput = renderDB; $(id).onchange = renderDB;
});
$('prevMonth').onclick = () => { if (--calMonth < 0) { calMonth = 11; calYear--; } renderCal(); };
$('nextMonth').onclick = () => { if (++calMonth > 11) { calMonth = 0; calYear++; } renderCal(); };
$('todayBtn').onclick  = () => { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderCal(); };

/* ═══════════ 일정 추가 / 수정 ═══════════ */
function fillStages() {
  $('fstage').innerHTML = STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
}
function fillResults(stage, cur) {
  const opts = resultOptions(stage);
  $('fresult').innerHTML = opts.map(o =>
    `<option value="${o}" ${o === cur ? 'selected' : ''}>${RESULTS[o].label}</option>`).join('');
  if (!opts.includes(cur)) $('fresult').value = '';
}
fillStages();
$('fstage').onchange = () => fillResults($('fstage').value, $('fresult').value);

function clearForm() {
  $('form').reset(); $('fid').value = '';
  $('fcompany').readOnly=false; $('frole').readOnly=false;
  delete $('form').dataset.appCompany; delete $('form').dataset.appRole;
  $('ftier').value = 'A'; $('fstage').value = 'apply'; fillResults('apply', '');
  $('deleteBtn').hidden = true; $('openUrlBtn').hidden = true;
  $('modalTitle').textContent = '일정 추가';
}
$('addBtn').onclick = () => { clearForm(); openSheet('modalBg'); };
$('cancelBtn').onclick = () => closeSheet('modalBg');

function edit(id) {
  const x = events().find(v => v.id === id); if (!x) return;
  $('modalTitle').textContent = '일정 수정';
  $('fid').value = x.id; $('fcompany').value = x.company; $('frole').value = x.role;
  $('fcompany').readOnly=true; $('frole').readOnly=true;
  $('ftier').value = x.tier; $('fdate').value = x.date; $('ftime').value = x.time || '';
  $('fstage').value = x.stage; fillResults(x.stage, x.result || '');
  $('fenglish').value = x.english || ''; $('fnote').value = x.note || ''; $('furl').value = x.url || '';
  $('openUrlBtn').hidden = !x.url; $('openUrlBtn').href = x.url || '#';
  $('deleteBtn').hidden = false;
  openSheet('modalBg');
}

function addStage(key) {
  const g = groups().find(v => v.key === key); if (!g) return;
  const lastIdx = Math.max(...g.items.map(i => sIdx(i.stage)));
  const nextKey = STAGE_ORDER[Math.min(lastIdx + 1, STAGE_ORDER.length - 1)];
  clearForm();
  $('modalTitle').textContent = `${g.company} · 다음 전형`;
  $('fcompany').value = g.company; $('frole').value = g.role; $('ftier').value = g.tier;
  $('fcompany').readOnly=true; $('frole').readOnly=true;
  $('form').dataset.appCompany=g.company; $('form').dataset.appRole=g.role;
  $('fstage').value = nextKey === 'open' ? 'result' : nextKey;
  fillResults($('fstage').value, '');
  $('fenglish').value = g.english || ''; $('furl').value = g.url || '';
  $('fdate').value = todayStr();
  if (g.url) { $('openUrlBtn').hidden = false; $('openUrlBtn').href = g.url; }
  openSheet('modalBg');
}

$('form').onsubmit = e => {
  e.preventDefault();
  const id = $('fid').value || 'id-' + Date.now();
  const stage = $('fstage').value;
  const prev = events().find(v => v.id === id);
  const x = {
    id, company:prev?prev.company:($('form').dataset.appCompany||$('fcompany').value.trim()),
    role:prev?prev.role:($('form').dataset.appRole||$('frole').value.trim()),
    tier: $('ftier').value, date: $('fdate').value, time: $('ftime').value, stage,
    kind: stage === 'apply' ? 'deadline' : stage === 'open' ? 'open'
        : (stage === 'info' || stage === 'cert') ? 'event' : 'process',
    result: $('fresult').value, hold: prev ? !!prev.hold : false,
    english: $('fenglish').value.trim(), note: $('fnote').value.trim(),
    url: $('furl').value.trim(), status:'', progress:0
  };
  const i = events().findIndex(v => v.id === id);
  if (i >= 0) state.events[i] = x; else state.events.push(x);
  const k = appKey(x);
  state.events.forEach(v => { if (appKey(v) === k) { v.hold = x.hold; v.tier = x.tier; } });
  save(); closeSheet('modalBg');
};
$('deleteBtn').onclick = () => {
  const id = $('fid').value;
  const cur = events().find(v => v.id === id);
  const sameCount = cur ? events().filter(v => appKey(v) === appKey(cur)).length : 0;
  const msg = sameCount > 1
    ? `이 일정 하나만 삭제합니다.\n${cur.company}에는 다른 전형 일정 ${sameCount - 1}건이 남습니다.\n(지원 건 전체를 지우려면 지원 목록에서 '삭제'를 누르세요)`
    : '이 일정을 삭제할까요?';
  if (id && confirm(msg)) {
    state.events = events().filter(x => x.id !== id);
    save(); closeSheet('modalBg');
  }
};

/* ═══════════ 백업 ═══════════ */
$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(state,null,2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `job-radar-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('importFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      let next;
      if (Array.isArray(j)) next = { events:j, axes:{}, inbox:[], dismissed:[], updatedAt:Date.now() };
      else if (j && Array.isArray(j.events)) next = { axes:{}, ...j };
      else throw 0;

      const when = next.updatedAt ? new Date(next.updatedAt).toLocaleDateString('ko-KR') : '날짜 없음';
      const cos  = new Set((next.events || []).map(e => e.company).filter(Boolean)).size;
      const ok = confirm(
        `이 백업으로 바꿉니다.\n\n` +
        `백업 시점 : ${when}\n` +
        `지원 기업 : ${cos}곳\n` +
        `일정      : ${(next.events || []).length}건\n` +
        `검토함    : ${(next.inbox || []).length}건\n\n` +
        `지금 이 기기의 데이터(일정 ${events().length}건)는 사라집니다.\n` +
        `되돌리기용 사본은 자동으로 남겨둡니다. 계속할까요?`);
      if (!ok) { e.target.value = ''; return; }

      checkpoint('restore');
      state = migrate(next);
      save(); toast('불러오기 완료 · 잘못됐으면 더보기에서 되돌릴 수 있습니다');
    } catch (err) { alert('백업 파일을 확인해줘'); }
    e.target.value = '';
  };
  r.readAsText(f);
};

/** 자동 사본으로 되돌리기 (#44) */
function recoveryInfo() {
  try { const r = JSON.parse(localStorage.getItem(RECOVERY_KEY)); return r && r.state ? r : null; }
  catch (e) { return null; }
}
function refreshRecoveryUI() {
  const btn = $('recoverBtn'); if (!btn) return;
  const r = recoveryInfo();
  btn.hidden = !r;
  if (r) {
    let n = 0; try { n = (JSON.parse(r.state).events || []).length; } catch (e) {}
    const sub = btn.querySelector('.rowS');
    if (sub) sub.textContent = `${new Date(r.at).toLocaleString('ko-KR')} 시점 · 일정 ${n}건으로 되돌립니다`;
  }
}
if ($('recoverBtn')) $('recoverBtn').onclick = () => {
  const r = recoveryInfo(); if (!r) { toast('되돌릴 사본이 없습니다'); return; }
  if (!confirm(`${new Date(r.at).toLocaleString('ko-KR')} 시점으로 되돌립니다.\n지금 데이터는 사라집니다. 계속할까요?`)) return;
  checkpoint('undo-restore');
  try { state = migrate(JSON.parse(r.state)); save(); toast('되돌렸습니다'); go('home'); }
  catch (e) { alert('사본을 읽지 못했습니다'); }
};

$('wipeBtn').onclick = () => {
  if (!confirm('이 기기의 모든 지원 데이터를 지웁니다.\n일정 · 검토함 · 평가축이 전부 사라지고 되돌릴 수 없습니다.\n계속할까요?')) return;
  if (!confirm('정말 전부 지울까요? 백업을 받아두지 않았다면 지금 취소하세요.')) return;
  checkpoint('wipe');
  const keepProfile = state.profile;
  state = blankState(keepProfile);
  save(); toast('일정·검토함·평가축을 지웠습니다 · 내 기준은 그대로'); go('home');
};

/* 남에게 넘기기 전 완전 초기화 — 기준·설문·동기화 설정까지 전부 */
$('handoffBtn').onclick = () => {
  if (!confirm('이 기기를 처음 설치한 상태로 되돌립니다.\n일정 · 검토함 · 설문 결과 · 동기화 설정이 전부 사라집니다.\n\n다른 사람에게 넘길 때만 쓰세요. 계속할까요?')) return;
  if (!confirm('정말 전부 지울까요? 되돌릴 수 없습니다.')) return;
  // 남에게 넘기는 것이므로 되돌리기용 사본을 남기지 않는다.
  // 사본을 남기면 다음 사용자가 «자동 사본으로 되돌리기»로 앞사람 데이터를 복구할 수 있다.
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem(RECOVERY_KEY);
  } catch (e) {}
  location.reload();
};

/* ═══════════ 마감 일정 캘린더(.ics) 내보내기 ═══════════
 * 아이폰·구글 캘린더에 넣으면 시스템 알림이 온다. 앱 푸시 없이 마감을 놓치지 않는 방법.
 */
function icsEscape(t) { return String(t||'').replace(/([,;\\])/g,'\\$1').replace(/\n/g,'\\n'); }
function buildICS() {
  const gs = groups();
  const pad = n => String(n).padStart(2,'0');
  const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const now = stamp(new Date());
  const L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//chwijun-radar//KR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:취준 Radar'];
  let n = 0;
  for (const g of gs) {
    if (g.dropped) continue;
    for (const x of g.items) {
      if (isPast(x) || hiddenByArchive(x)) continue;
      const st = stageOf(x);
      const start = dObj(x.date, x.time || '09:00');
      const end = new Date(start.getTime() + 60*60*1000);
      L.push('BEGIN:VEVENT',
        `UID:${x.id}@chwijun-radar`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${icsEscape(`[${st.short}] ${x.company} · ${x.role}`)}`,
        `DESCRIPTION:${icsEscape([st.label, x.english && ('영어·자격 ' + x.english), x.note].filter(Boolean).join(' / '))}`,
        ...(safeUrl(x.url) ? [`URL:${icsEscape(safeUrl(x.url))}`] : []),
        'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:내일 마감','END:VALARM',
        'BEGIN:VALARM','TRIGGER:-PT3H','ACTION:DISPLAY','DESCRIPTION:3시간 뒤 마감','END:VALARM',
        'END:VEVENT');
      n++;
    }
  }
  L.push('END:VCALENDAR');
  return { text: L.join('\r\n'), count: n };
}
$('icsBtn').onclick = () => {
  const { text, count } = buildICS();
  if (!count) { toast('내보낼 예정 일정이 없습니다'); return; }
  const blob = new Blob([text], { type:'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chwijun-radar-${new Date().toISOString().slice(0,10)}.ics`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${count}건 · 캘린더 앱에서 열면 알림이 걸립니다`);
};

/* ═══════════ 공고 가져오기 ═══════════ */
function parseImport(raw) {
  let t = String(raw || '').trim();
  if (!t) throw new Error('붙여넣은 내용이 없습니다');
  t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
  const tryJSON = x => { try { return JSON.parse(String(x).replace(/,(\s*[\]}])/g, '$1')); } catch (e) { return undefined; } };

  let data = tryJSON(t);
  if (data === undefined) {
    const i = t.indexOf('['), j = t.lastIndexOf(']');
    const o = t.indexOf('{'), c = t.lastIndexOf('}');
    if (o >= 0 && c > o && (i < 0 || o < i)) data = tryJSON(t.slice(o, c + 1));
    if (data === undefined && i >= 0 && j > i) data = tryJSON(t.slice(i, j + 1));
    if (data === undefined && o >= 0 && c > o) data = tryJSON('[' + t.slice(o, c + 1) + ']');
  }
  if (data === undefined || data === null) throw new Error('JSON을 읽지 못했습니다');
  if (Array.isArray(data)) return { items: data, checks: [], out: [], qualifications: [] };

  const checks = Array.isArray(data.checks) ? data.checks
               : Array.isArray(data['확인']) ? data['확인']
               : Array.isArray(data['크로스체크']) ? data['크로스체크'] : [];
  let items = Array.isArray(data.items) ? data.items
            : Array.isArray(data.events) ? data.events
            : Array.isArray(data['공고']) ? data['공고'] : null;
  if (!items) items = checks.length ? [] : [data];
  const out = Array.isArray(data.out) ? data.out
            : Array.isArray(data['제외']) ? data['제외'] : [];
  const qs = Array.isArray(data.qualifications) ? data.qualifications
           : Array.isArray(data['어학']) ? data['어학'] : [];
  return { items, checks, out, qualifications: qs };
}

/* ── 확인 요청 대상 = 이미 지원 목록에 있는 회사 ─────────────
 * 따로 등록해서 관리하는 목록은 두지 않는다. 지원 목록이 곧 대상이다.
 * GPT 가 공식 채용 페이지를 확인하고 checks 로 돌려주면,
 * 확인이 안 온 회사만 가져오기 결과에 한 줄로 남긴다. */
const normCompany = s => String(s || '').replace(/\s|\(.*?\)|주식회사|㈜/g, '').toLowerCase();

/** 지원 목록에 있는 회사들 (자격·어학 제외). [{company, url}] */
function myCompanies() {
  const m = new Map();
  events().forEach(e => {
    if (isCert(e) || !e.company) return;
    const k = normCompany(e.company);
    if (!m.has(k)) m.set(k, { company: e.company, url: e.url || '' });
    else if (!m.get(k).url && e.url) m.get(k).url = e.url;
  });
  return [...m.values()];
}

/** 돌아온 확인 결과를 지원 목록과 대조한다. 저장하지 않는다. */
function checkSummary(checks) {
  const mine = myCompanies();
  if (!mine.length) return { checked: 0, missing: [], total: 0 };
  const seen = new Set();
  (checks || []).forEach(c => {
    const co = String(c.company || c['기업'] || c['회사'] || '').trim();
    if (co) seen.add(normCompany(co));
  });
  const missing = mine.filter(x => !seen.has(normCompany(x.company))).map(x => x.company);
  return { checked: mine.length - missing.length, missing, total: mine.length };
}

function normalizeInbox(v) {
  const company = String(v.company || v.기업 || v.회사 || '').trim();
  const role    = String(v.role || v.직무 || '').trim();
  if (!company || !role) return null;
  const tier = TIER_ALIAS[String(v.tier || v.등급 || 'A').trim().toUpperCase()] || 'A';
  let raw = Array.isArray(v.schedule) ? v.schedule : [];
  if (!raw.length && v.date) raw = [{ stage: v.stage || 'apply', date: v.date, time: v.time || '' }];
  const schedule = raw.map(e => {
    const date = String(e.date || e.날짜 || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    let time = String(e.time || e.시간 || '').trim();
    if (time && !/^\d{1,2}:\d{2}$/.test(time)) time = '';
    if (time.length === 4) time = '0' + time;
    return { stage: STAGE_ALIAS[String(e.stage || e.단계 || 'apply').trim()] || 'apply', date, time, on:true };
  }).filter(Boolean).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  if (!schedule.length) return null;

  // 출처 검증: 공식 URL 이 없거나 GPT 가 [미검증] 을 붙였으면 그대로 드러낸다
  let note = String(v.note || v['메모'] || v['비고'] || '').trim();
  let unverified = false;
  if (/^\s*\[미검증\]/.test(note)) { unverified = true; note = note.replace(/^\s*\[미검증\]\s*/, ''); }
  let url = String(v.url || v['링크'] || '').trim();
  if (!/^https?:\/\//.test(url)) { url = ''; unverified = true; }

  return {
    id: 'in-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
    company, role, tier, schedule,
    jd:      String(v.jd || v.주요업무 || v.업무 || '').trim(),
    require: String(v.require || v.자격요건 || v.지원자격 || '').trim(),
    english: String(v.english || v.영어 || '').trim(),
    note:    note,
    url:     url,
    unverified,
    addedAt: Date.now()
  };
}
const importBlocked = x => { const r = overrideFor(x.company, x.role);
  return !!r && (r.kind === 'BEN' || r.kind === 'ROUTE'); };

function runImport(rawText) {
  const { items: arr, checks, out, qualifications: qIn } = parseImport(rawText);
  const cr = checkSummary(checks);
  const inEvents = new Set(events().map(x => `${x.company}|${x.role}`));
  const inInbox  = new Set(state.inbox.map(x => `${x.company}|${x.role}`));
  const dropped  = new Set(state.dismissed || []);
  let added = 0, dup = 0, bad = 0, blocked = 0, before = 0;
  for (const v of arr) {
    const x = normalizeInbox(v);
    if (!x) { bad++; continue; }
    if (importBlocked(x)) { blocked++; continue; }
    const k = `${x.company}|${x.role}`;
    if (dropped.has(k)) { before++; continue; }
    if (inEvents.has(k) || inInbox.has(k)) { dup++; continue; }
    inInbox.add(k); state.inbox.push(x); added++;
  }
  // «이건 이제 빼라» 제안 — 지금 진행 중인 건과 실제로 맞는 것만 남긴다.
  // 없는 회사를 제안했다고 조용히 넘기지 않는다: unknown 으로 세어서 보여준다.
  const live = new Map(groups().filter(g => !g.closed).map(g => [g.key, g]));
  const already = new Set((state.outProposals || []).map(o => o.key));
  const ign = (state.ignoredOut = state.ignoredOut || {});
  let outAdded = 0, outUnknown = 0, outMuted = 0;
  (out || []).forEach(o => {
    const co = String(o.company || o['회사'] || '').trim();
    const ro = String(o.role || o['직무'] || '').trim();
    if (!co) return;
    const hit = [...live.values()].find(g =>
      normCompany(g.company) === normCompany(co) && (!ro || g.role === ro));
    if (!hit) { outUnknown++; return; }
    if (already.has(hit.key)) return;
    // 전에 무시했고 그 뒤로 아무것도 안 바뀌었으면 다시 묻지 않는다
    const prev = ign[hit.key];
    if (prev && prev.basis === outBasis(hit)) { outMuted++; return; }
    if (prev) delete ign[hit.key];        // 근거가 바뀌었다 — 무시를 해제하고 다시 묻는다
    already.add(hit.key);
    state.outProposals.push({ key: hit.key, company: hit.company, role: hit.role,
      reason: String(o.reason || o['이유'] || '').slice(0, 200), at: Date.now() });
    outAdded++;
  });

  // 어학 성적 — 같은 시험·시험일이면 갱신, 아니면 추가. 점수를 지어내지 않는다.
  let qAdded = 0, qUpd = 0;
  (qIn || []).forEach(v => {
    const type = String(v.type || v['시험'] || '').trim();
    if (!type) return;
    const testDate = String(v.testDate || v['시험일'] || '');
    const rec = { type,
      score: (v.score === null || v.score === undefined || v.score === '') ? null : Number(v.score),
      grade: (v.grade === null || v.grade === undefined || v.grade === '') ? null : String(v.grade).toUpperCase(),
      testDate, resultDate: String(v.resultDate || v['결과발표'] || ''),
      validUntil: String(v.validUntil || v['유효기간'] || '') };
    const hit = quals().find(q => normTest(q.type) === normTest(type) && q.testDate === testDate);
    if (hit) { Object.assign(hit, rec); qUpd++; }
    else { quals().push({ id:'q-'+Math.random().toString(36).slice(2,8), ...rec }); qAdded++; }
  });

  let unv = 0;
  state.inbox.forEach(x => { if (x.unverified) unv++; });
  state.radarMeta = { lastImportAt:Date.now(), lastCandidateCount:arr.length, lastNewCount:added };
  save();
  return { total:arr.length, added, dup, bad, blocked, before, unv, outAdded, outUnknown, outMuted,
           qAdded, qUpd, checked: cr.checked, missing: cr.missing, watched: cr.total };
}

function renderRadarFreshness() {
  const el = $('radarFreshness'); if (!el) return;
  const m = state.radarMeta || {};
  if (!m.lastImportAt) {
    el.innerHTML = '<b>아직 가져온 레이더 결과가 없습니다</b><span>기기간 동기화와 별도로 기록됩니다.</span>';
    return;
  }
  const at = new Date(m.lastImportAt).toLocaleString('ko-KR', {
    month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
  });
  el.innerHTML = `<b>마지막 가져오기 ${esc(at)}</b><span>후보 ${Number(m.lastCandidateCount)||0}건 · 새 후보 ${Number(m.lastNewCount)||0}건</span>`;
}

$('importBtn').onclick = () => openSheet('impBg');
$('impCancel').onclick = () => closeSheet('impBg');
$('viewPromptBtn').onclick = () => {
  const b = $('promptBox'); b.value = myPrompt(); b.hidden = !b.hidden;
  $('viewPromptBtn').textContent = b.hidden ? '보기' : '접기';
};
/** 내 어학·자격 + 각 요건에 대한 판정 규칙. UI 와 같은 계산기를 쓴다. */
function qualSection() {
  const qs = quals();
  if (!qs.length) return `

[내 어학·자격]
등록된 성적 없음. 어학 요건이 있는 공고는 english 에 요건을 그대로 적고
eligibility 는 "어학 확인 필요" 로 둬라. 내 점수를 추측하지 마라.`;
  const lines = qs.map(q => {
    const st = qualStatus(q);
    const v = q.grade || (q.score !== null && q.score !== '' ? q.score : '');
    if (st === 'pending') return `- ${q.type}: 결과 발표 전 (시험일 ${q.testDate || '미상'}` +
      `${q.resultDate ? `, 발표 ${q.resultDate}` : ''}) — 점수 없음`;
    if (st === 'needsInput') return `- ${q.type}: 발표일${q.resultDate ? ` ${q.resultDate}` : ''}이 지났는데 ` +
      `점수가 아직 입력되지 않음 — «결과 대기» 가 아니라 «어학 확인 필요» 로 다뤄라`;
    if (st === 'expired') return `- ${q.type}: ${v} (유효기간 만료 ${q.validUntil})`;
    return `- ${q.type}: ${v}${q.validUntil ? ` (유효 ~${q.validUntil})` : ''}`;
  }).join('\n');
  return `

[내 어학·자격]
${lines}

[어학 판정 규칙 — 반드시 지킬 것]
공고마다 eligibility 를 아래 네 값 중 하나로만 적어라.
- "어학 충족"      내 성적이 요건을 넘는다
- "어학 미달"      내 성적이 요건에 못 미친다
- "어학 결과 대기" 요건에 걸리는 시험의 «발표일이 아직 안 왔다» → 미달이라고 쓰지 마라
- "어학 확인 필요" 성적이 아예 없거나, 발표일이 지났는데 점수를 모르거나, 요건 문구를 확정할 수 없다
이 판정은 «공인어학» 에 대해서만 말하는 것이다. 전공·자격증·학점 같은 비어학 요건은
여기서 판정하지 말고 require 에 그대로 적어라.
결과 발표 전인 시험을 근거로 «미달» 이라고 판단하는 것을 금지한다.
어학 미달이라는 이유만으로 공고를 목록에서 빼지 마라 — 표시만 하고 판단은 내가 한다.`;
}

/** 지금 지원 상태 · 더 이상 보지 않을 것. 앱 state 가 Source of Truth 다. */
function statusSection() {
  const gs = groups();
  const live = gs.filter(g => !g.closed);
  const out  = gs.filter(g => g.archived || g.dropped);
  const pf = profile();
  const exC = (pf.excludeCompanies || []).filter(Boolean);
  const exR = (pf.excludeRoles || []).filter(Boolean);
  const dismissed = (state.dismissed || []).length;

  const liveLines = live.map(g =>
    `- ${g.company} — ${g.role} · ${g.status}${g.hold ? ' (보류)' : ''}` +
    `${g.next ? ` · 다음 ${stageOf(g.next).label} ${g.next.date}` : ''}` +
    `${g.url ? ` · ${g.url}` : ''}`).join('\n') || '- (없음)';
  const outLines = out.map(g => `- ${g.company} — ${g.role}` +
    `${g.dropped ? ' (불합격)' : ' (종료)'}`).join('\n');

  return `

[지금 진행 중인 지원 ${live.length}건 — 이게 최신이다]
${liveLines}

[더 이상 추천하지 말 것]
${outLines || '- (없음)'}
${exC.length ? `- 아예 제외할 회사: ${exC.join(', ')}` : ''}
${exR.length ? `- 아예 제외할 직무·근무형태: ${exR.join(', ')}` : ''}
${dismissed ? `- 검토함에서 내가 이미 뺀 공고 ${dismissed}건은 다시 올리지 마라` : ''}

[확인 요청 — 위 «진행 중» ${live.length}건 전부]
기억이나 추측으로 답하지 마라.
1) 각 회사의 공식 채용 페이지를 실제로 열어라. 주소가 적혀 있으면 그 주소를 먼저 연다.
2) 채용 플랫폼(사람인·잡코리아·링크드인 등)에서 한 번 더 교차 확인해라.
   공식 페이지와 내용이 다르면 공식 페이지를 따르고, 그 차이를 note 에 적어라.
3) 확인 결과를 checks 배열에 ${live.length}건 전부 적어라.
   새 공고가 있으면 "found", 없으면 "none", 페이지를 못 열었으면 "fail" 이라고 솔직히 적어라.
   확인 못 한 것을 없는 것처럼 넘어가지 마라.

[출력 형식 — 배열 대신 아래 객체 하나만 출력]
{
  "items": [ ...위 스키마의 공고 객체들. 각 항목에 "eligibility" 를 넣어라. 없으면 [] ... ],
  "out":   [ { "company":"회사명", "role":"직무명", "reason":"왜 빼는지 한 줄" } ],
  "checks": [
    { "company": "회사명", "url": "실제로 연 주소", "checkedAt": "YYYY-MM-DD",
      "status": "found | none | fail", "note": "한 줄 근거" }
  ]
}
out 은 «내가 더 이상 지원하지 않기로 한 건» 을 제안하는 자리다.
앱이 자동으로 지우지 않는다 — 내가 앱에서 하나씩 보고 승인한다.`;
}
/* ═══ 프롬프트는 파생물이다. 저장하지 않고 부를 때마다 state 에서 다시 만든다 ═══
 *  저장해두면 지원 목록·어학·제외 규칙을 바꿔도 옛날 문장이 그대로 나간다.
 *  (v8.0 까지 실제로 그랬다 — «그대로 쓰기» 사용자는 data.js 하드코딩본에 묶여 있었다) */
const PROMPT_VERSION = 3;
const myPrompt = () => buildPrompt(profile()) + qualSection() + statusSection();
$('copyPromptBtn').onclick = async () => {
  const t = myPrompt();
  try { await navigator.clipboard.writeText(t); toast('프롬프트를 복사했습니다'); }
  catch (e) { const b = $('promptBox'); b.hidden = false; b.value = t; b.select(); toast('아래 내용을 직접 복사해줘'); }
};
$('clipboardImportBtn').onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!String(t || '').trim()) throw new Error('empty');
    $('impBox').value = t;
    $('impRun').click();
  } catch (e) {
    $('impBox').focus();
    toast('클립보드를 읽지 못했습니다 · 아래 칸을 길게 눌러 붙여넣어 주세요');
  }
};
$('impRun').onclick = () => {
  try {
    const r = runImport($('impBox').value);
    let html = `<div class="impOk"><b>검토함에 ${r.added}건</b>${
      r.dup ? ` · 이미 있음 ${r.dup}` : ''}${r.before ? ` · 전에 제외 ${r.before}` : ''}${
      r.blocked ? ` · 보정 차단 ${r.blocked}` : ''}${r.bad ? ` · 형식 오류 ${r.bad}` : ''}</div>`;
    if (r.outAdded) html += `<div class="impChk"><b>종료 제안 ${r.outAdded}건</b><span>새 공고 화면에서 하나씩 확인하고 승인하세요. 승인 전에는 아무것도 안 바뀝니다.</span></div>`;
    if (r.outUnknown) html += `<div class="impWarn">지원 목록에 없는 회사를 ${r.outUnknown}건 빼라고 했습니다 — 무시했습니다.</div>`;
    if (r.outMuted) html += `<div class="impChk"><b>전에 무시한 종료 제안 ${r.outMuted}건</b><span>그 뒤로 상태·어학·일정이 그대로여서 다시 띄우지 않았습니다.</span></div>`;
    if (r.qAdded || r.qUpd) html += `<div class="impChk"><b>어학·자격 ${
      r.qAdded ? `${r.qAdded}건 추가` : ''}${r.qAdded && r.qUpd ? ' · ' : ''}${
      r.qUpd ? `${r.qUpd}건 갱신` : ''}</b><span>더보기 → 내 어학·자격에서 확인하세요.</span></div>`;
    if (r.watched && r.missing.length) {
      html += `<div class="impChk"><b>확인 결과가 안 온 회사 ${r.missing.length}곳</b><span>${
        esc(r.missing.join(', '))} — GPT에 다시 물어보세요</span></div>`;
    }
    if (r.unv) html += `<div class="impWarn">공식 링크가 없는 공고 ${r.unv}건은 <b>미검증</b>으로 표시했습니다. 캘린더에 넣기 전에 직접 확인하세요.</div>`;
    $('impResult').innerHTML = html;
    if (r.added || r.outAdded || r.qAdded || r.qUpd) {
      $('impBox').value = '';
      setTimeout(() => { closeSheet('impBg'); go('inbox'); }, r.missing && r.missing.length ? 1600 : 250);
      renderRadarFreshness();
      toast(`검토함에 ${r.added}건 도착`);
    }
  } catch (e) {
    $('impResult').innerHTML = `<div class="impErr">읽지 못했습니다 — GPT가 준 JSON 전체를 붙여넣었는지 확인해줘.</div>`;
  }
};


/* 자체 점검용 훅 (QA 스크립트에서만 사용) */
window.__dbg = { myPrompt: () => myPrompt(), state: () => state, myCompanies: () => myCompanies(),
  persist: () => persist(), save: () => save(), pull: o => pull(o), push: o => push(o),
  ics: () => buildICS(), archive: (k,on) => archiveApp(k,on),
  feedRoleMatch: role => feedRoleMatch(role), updateAppBadge: () => updateAppBadge(),
  setSyncUI: (a,b) => setSyncUI(a,b),
  evalElig: (t,q) => evaluateEligibility(t, q === undefined ? quals() : q),
  quals: () => quals(), qualStatus: q => qualStatus(q),
  parseReq: t => parseRequirement(t),
  cfg: () => cfg, syncIssue: () => syncIssue,
  openSheet: id => openSheet(id), closeSheet: id => closeSheet(id) };

/* ═══════════ 온보딩 설문 ═══════════ */
const OB = { step: 0, draft: null };
// 새 Radar는 우선 이 기기에만 저장한다. 기기간 동기화는 사용자가 필요할 때
// 더보기 → 휴대폰과 연결에서 명시적으로 켠다. 기존 Radar 복원 경로는 그대로다.
const OB_STEPS = ['welcome','basic','jobs','rank','criteria','exclude','open','done'];

const isReturning = () => events().length > 0 || (state.axes && Object.keys(state.axes).length > 0);

function startOnboarding(force) {
  if (force) OB.draft = { ...emptyProfile(), ...profile(), done:false };
  else {
    OB.draft = { ...emptyProfile() };
    if (isReturning()) {          // 예전부터 쓰던 사람 — 기존 기준을 기본값으로
      OB.draft.excludeCompanies = [...LEGACY_EXCLUDE_COMPANIES];
      OB.draft.excludeRoles = [...LEGACY_EXCLUDE_ROLES];
      OB.draft.pdb = true;
    }
  }
  OB.step = force ? 1 : 0;
  OB.key = null; OB.noSync = true; OB.restoring = false;
  $('onboard').hidden = false;
  document.body.style.overflow = 'hidden';
  renderOB();
}

/** 설문을 건너뛰고 예전처럼 계속 쓴다 (기존 사용자 전용) */
function keepAsIs() {
  const pf = { ...emptyProfile(), done:true, pdb:true, createdAt:Date.now(),
    excludeCompanies:[...LEGACY_EXCLUDE_COMPANIES], excludeRoles:[...LEGACY_EXCLUDE_ROLES] };
  pf.prompt = ''; pf.promptVersion = PROMPT_VERSION;   // 프롬프트는 파생물이라 저장하지 않는다
  state.profile = pf; save(); applyProfileVisibility(); endOnboarding();
  toast('기존 설정 그대로 유지합니다 · 더보기에서 언제든 설문할 수 있어요');
}
function endOnboarding() {
  $('onboard').hidden = true;
  document.body.style.overflow = '';
}

function renderOB() {
  const k = OB_STEPS[OB.step], d = OB.draft;
  const total = OB_STEPS.length - 1;
  $('obProgFill').style.width = Math.round((OB.step / total) * 100) + '%';
  $('obStepNo').textContent = OB.step === 0 ? '' : `${OB.step}/${total}`;
  $('obBack').hidden = OB.step === 0;
  $('obSkip').hidden = !['jobs','rank','criteria','exclude','open'].includes(k);
  $('obNext').textContent =
    k === 'welcome' ? '시작하기' : k === 'done' ? '앱 시작하기' : k === 'key' ? '복사했어요, 다음' : '다음';

  const B = $('obBody');
  if (k === 'welcome') B.innerHTML = `
    ${!isReturning() ? `<div class="obReturn">
       <b>다른 기기에서 이미 쓰고 있나요?</b>
       <span>그렇다면 설문을 다시 할 필요가 없습니다. 동기화 비밀키만 넣으면
       지원 목록·일정·내 기준이 그대로 따라옵니다.</span>
       <button class="btn btnGhost full" id="obRestore">기존 Radar 불러오기</button>
     </div>` : ''}
    ${isReturning() ? `<div class="obReturn">
       <b>이미 쓰고 계시네요</b>
       <span>지금까지 넣은 일정과 데이터는 그대로 있습니다. 설문은 «내 기준»만 만드는 것이고,
       건너뛰면 예전 기준(APR·롯데백화점 제외 등)을 그대로 씁니다.</span>
       <button class="btn btnGhost full" id="obKeep">설문 건너뛰고 그대로 쓰기</button>
     </div>` : ''}
    <div class="obTitle">${isReturning() ? '취준 Radar를<br>내 기준에 맞춥니다' : '새 Radar 만들기'}</div>
    <p class="obLead">지원 일정과 전형 단계를 한 곳에서 관리하고, 새 공고를 내 기준으로 걸러서 봅니다.<br><br>
    몇 가지만 물어볼게요. <b>2~3분</b>이면 끝나고, 나중에 언제든 바꿀 수 있습니다.</p>
    <div class="doneBox"><h4>여기서 만드는 것</h4><ol>
      <li>내 지원 직무와 경험</li>
      <li>커리어에서 중요한 순서</li>
      <li>회사 볼 때 따지는 조건</li>
      <li>절대 안 갈 회사·직무</li>
      <li>→ 이 기준으로 <b>새 채용공고를 자동으로 걸러봅니다</b></li>
    </ol></div>`;

  else if (k === 'basic') B.innerHTML = `
    <div class="obTitle">기본 정보</div>
    <p class="obLead">공고의 지원 자격을 걸러낼 때 씁니다.</p>
    <div class="obSection">
      <label class="obLabel">이름 (앱에서만 보입니다)</label>
      <input class="obInput" id="i_name" value="${esc(d.name)}" placeholder="예: 변준기">
    </div>
    <div class="obSection">
      <label class="obLabel">졸업 연월 · 전공</label>
      <div class="obRow">
        <input class="obInput" id="i_grad" value="${esc(d.grad)}" placeholder="2025.02">
        <input class="obInput" id="i_major" value="${esc(d.major)}" placeholder="사회환경공학">
      </div>
      <p class="obNote">전공이 지정된 공고를 걸러낼 때 쓰입니다. 예: “전자·전기·기계 전공만” 같은 공고를 자동으로 제외합니다.</p>
    </div>`;

  else if (k === 'jobs') B.innerHTML = `
    <div class="obTitle">어떤 직무를 지원하나요?</div>
    <p class="obLead">여러 개 고를 수 있습니다. 없으면 직접 적어주세요.</p>
    <div class="pickWrap" id="jobPick">
      ${JOB_OPTIONS.map(j => `<button class="pick ${d.jobs.includes(j)?'on':''}" data-job="${esc(j)}">${esc(j)}</button>`).join('')}
    </div>
    <div class="obSection" style="margin-top:18px">
      <label class="obLabel">직접 추가 (쉼표로 구분)</label>
      <input class="obInput" id="i_jobetc" placeholder="예: 입지개발, 가맹기획"
             value="${esc(d.jobs.filter(j => !JOB_OPTIONS.includes(j)).join(', '))}">
    </div>`;

  else if (k === 'rank') {
    const order = d.axisOrder || [];
    B.innerHTML = `
    <div class="obTitle">커리어에서<br>중요한 순서대로 눌러주세요</div>
    <p class="obLead">누른 순서가 곧 우선순위가 되고, 공고를 고를 때 <b>가중치로 자동 계산</b>됩니다.
    전부 안 골라도 됩니다. ${order.length ? `<b>${order.length}개 선택됨</b>` : ''}</p>
    <div class="rankList">
      ${VALUE_AXES.map(a => { const i = order.indexOf(a.key);
        return `<button class="rankItem ${i>=0?'on':''}" data-rank="${a.key}">
          <span class="rkNo">${i >= 0 ? i + 1 : ''}</span>
          <span class="rkMain"><span class="rkT">${a.label}</span><span class="rkD">${a.desc}</span></span>
        </button>`; }).join('')}
    </div>
    ${order.length ? `<button class="btn btnGhost full" id="rankReset" style="margin-top:14px">순서 다시 정하기</button>` : ''}`;
  }

  else if (k === 'criteria') B.innerHTML = `
    <div class="obTitle">회사를 볼 때<br>얼마나 따지나요?</div>
    <p class="obLead">0은 전혀 상관없음, 5는 매우 중요.</p>
    ${COMPANY_CRITERIA.map(c => { const v = d.criteria[c.key] ?? 3;
      return `<div class="critRow">
        <div class="critMain"><div class="critT">${c.label}</div><div class="critD">${c.desc}</div></div>
        <div class="dots">${[0,1,2,3,4,5].map(n =>
          `<button class="dot ${v===n?'on':''}" data-crit="${c.key}" data-v="${n}">${n}</button>`).join('')}</div>
      </div>`; }).join('')}`;

  else if (k === 'exclude') B.innerHTML = `
    <div class="obTitle">절대 안 갈 곳이<br>있나요?</div>
    <p class="obLead">여기 적으면 <b>추천에서 아예 빠지고</b>, 새 공고를 가져와도 앱이 자동으로 막습니다.</p>
    <div class="obSection">
      <label class="obLabel">제외할 회사</label>
      <div class="tagList" id="tagC">${(d.excludeCompanies||[]).map((c,i) =>
        `<span class="tag">${esc(c)}<button data-delc="${i}">×</button></span>`).join('')}</div>
      <div class="obRow">
        <input class="obInput" id="i_exc" placeholder="회사 이름" style="margin-bottom:0">
        <button class="btn btnGhost" id="addExc">추가</button>
      </div>
    </div>
    <div class="obSection">
      <label class="obLabel">제외할 직무·근무형태</label>
      <div class="tagList" id="tagR">${(d.excludeRoles||[]).map((c,i) =>
        `<span class="tag">${esc(c)}<button data-delr="${i}">×</button></span>`).join('')}</div>
      <div class="obRow">
        <input class="obInput" id="i_exr" placeholder="예: 점포관리, 지방순환" style="margin-bottom:0">
        <button class="btn btnGhost" id="addExr">추가</button>
      </div>
    </div>`;

  else if (k === 'open') B.innerHTML = `
    <div class="obTitle">마지막으로<br>몇 줄만 적어주세요</div>
    <p class="obLead">GPT가 공고를 고를 때 이 내용을 그대로 씁니다. 자세할수록 정확해집니다.</p>
    ${OPEN_QUESTIONS.map(q => `<div class="obSection">
      <label class="obLabel">${q.label}</label>
      <textarea class="obInput" id="i_${q.key}" rows="4" placeholder="${esc(q.ph)}">${esc(d[q.key]||'')}</textarea>
    </div>`).join('')}`;

  else if (k === 'key') {
    if (!OB.key) OB.key = cfg?.room || randomRoom();
    B.innerHTML = `
    <div class="obTitle">이 열쇠가<br>곧 내 계정입니다</div>
    <p class="obLead">이 앱은 회원가입이 없습니다. 아래 열쇠로 내 데이터가 구분되고, PC와 휴대폰이 같은 데이터를 씁니다.</p>
    <div class="keyBox">
      <div class="kLabel">내 동기화 열쇠</div>
      <div class="kVal" id="obKeyVal">${esc(OB.key)}</div>
      <div class="kWarn">⚠︎ 이 기기에만 저장됩니다. <b>잃어버리면 복구할 수 없습니다.</b><br>
      메모장이나 비밀번호 관리자에 꼭 복사해두세요. 남에게 공유하면 내 데이터를 볼 수 있습니다.</div>
    </div>
    <button class="btn btnGhost full" id="obCopyKey">열쇠 복사하기</button>
    <p class="obNote">다른 기기에서 이미 쓰고 있다면, 건너뛰고 나중에 <b>더보기 → 휴대폰과 연결</b>에서 연결 코드를 붙여넣으면 됩니다.</p>
    <button class="btn btnGhost full" id="obNoSync" style="margin-top:6px">동기화 없이 이 기기에서만 쓰기</button>`;
  }

  else if (k === 'done') {
    const pf = { ...OB.draft };
    pf.prompt = ''; pf.promptVersion = PROMPT_VERSION;
    B.innerHTML = `
    <div class="obTitle">준비 끝났습니다${pf.name ? `,<br>${esc(pf.name)}님` : ''}</div>
    <p class="obLead">이제 이 기준으로 공고를 걸러서 봅니다.</p>
    <div class="doneBox"><h4>이렇게 쓰면 됩니다</h4><ol>
      <li>앱을 열면 내 직무에 맞는 새 공고를 자동으로 확인합니다</li>
      <li><b>새 공고</b>에서 확인하고 캘린더에 넣을지 결정</li>
      <li>전형 결과가 나오면 지원 카드에서 <b>통과/탈락</b>만 눌러주면 상태·진행률은 자동</li>
    </ol></div>`;
  }

  bindOB();
}

function bindOB() {
  const d = OB.draft, k = OB_STEPS[OB.step];
  qsa('[data-job]').forEach(b => b.onclick = () => {
    const j = b.dataset.job;
    d.jobs = d.jobs.includes(j) ? d.jobs.filter(x => x !== j) : [...d.jobs, j];
    b.classList.toggle('on');
  });
  qsa('[data-rank]').forEach(b => b.onclick = () => {
    const key = b.dataset.rank;
    d.axisOrder = d.axisOrder.includes(key) ? d.axisOrder.filter(x => x !== key) : [...d.axisOrder, key];
    renderOB();
  });
  if ($('obKeep')) $('obKeep').onclick = keepAsIs;
  // 새 기기에서 처음 여는 사람 — 설문을 처음부터 시키지 않는다
  if ($('obRestore')) $('obRestore').onclick = () => {
    OB.restoring = true;
    openSync();                       // 온보딩은 그대로 두고 시트만 위에 띄운다 (실패해도 안 갇힌다)
    toast('다른 기기의 연결 코드나 비밀키를 넣어주세요');
  };
  if ($('rankReset')) $('rankReset').onclick = () => { d.axisOrder = []; renderOB(); };
  qsa('[data-crit]').forEach(b => b.onclick = () => {
    d.criteria[b.dataset.crit] = +b.dataset.v; renderOB();
  });
  if ($('addExc')) $('addExc').onclick = () => {
    const v = $('i_exc').value.trim(); if (!v) return;
    d.excludeCompanies = [...(d.excludeCompanies||[]), v]; renderOB();
  };
  if ($('addExr')) $('addExr').onclick = () => {
    const v = $('i_exr').value.trim(); if (!v) return;
    d.excludeRoles = [...(d.excludeRoles||[]), v]; renderOB();
  };
  qsa('[data-delc]').forEach(b => b.onclick = () => {
    d.excludeCompanies.splice(+b.dataset.delc, 1); renderOB(); });
  qsa('[data-delr]').forEach(b => b.onclick = () => {
    d.excludeRoles.splice(+b.dataset.delr, 1); renderOB(); });
  if ($('obCopyKey')) $('obCopyKey').onclick = async () => {
    try { await navigator.clipboard.writeText(OB.key); toast('열쇠를 복사했습니다'); }
    catch { prompt('아래 열쇠를 복사해 안전한 곳에 보관하세요', OB.key); }
  };
  if ($('obNoSync')) $('obNoSync').onclick = () => { OB.noSync = true; obNext(); };
  if ($('obCopyPrompt')) $('obCopyPrompt').onclick = async () => {
    try { await navigator.clipboard.writeText($('i_prompt').value); toast('프롬프트를 복사했습니다'); }
    catch { $('i_prompt').select(); toast('직접 복사해주세요'); }
  };
}

function collectOB() {
  const d = OB.draft, k = OB_STEPS[OB.step];
  if (k === 'basic') {
    d.name = $('i_name').value.trim();
    d.grad = $('i_grad').value.trim();
    d.major = $('i_major').value.trim();
  }
  if (k === 'jobs') {
    const etc = $('i_jobetc').value.split(',').map(x => x.trim()).filter(Boolean);
    d.jobs = [...d.jobs.filter(j => JOB_OPTIONS.includes(j)), ...etc];
  }
  if (k === 'open') OPEN_QUESTIONS.forEach(q => { d[q.key] = $('i_' + q.key).value.trim(); });
}

function obNext() {
  collectOB();
  const k = OB_STEPS[OB.step];
  if (k === 'key' && !OB.noSync && OB.key) {
    cfg = { url: DEFAULT_SYNC_URL, key: DEFAULT_SYNC_KEY, room: OB.key,
            baseRev: 0, dirty: events().length > 0,
            deviceId: 'd-' + Math.random().toString(36).slice(2,8) };
    saveCfg();
  }
  if (k === 'done') {
    const pf = { ...OB.draft, done:true, createdAt: OB.draft.createdAt || Date.now() };
    pf.prompt = ''; pf.promptVersion = PROMPT_VERSION;
    const old=state.profile||{}, filterChanged=JSON.stringify([old.jobs,old.excludeCompanies,old.excludeRoles])!==JSON.stringify([pf.jobs,pf.excludeCompanies,pf.excludeRoles]);
    state.profile = pf;
    if(filterChanged) {
      state.inbox=(state.inbox||[]).filter(x=>!x.feedKey||(feedRoleMatch(x.role)&&!importBlocked(x)));
      state.radarSeen={}; state.radarIdentity={};
    }
    save(); applyProfileVisibility(); endOnboarding();
    setSyncUI();
    if (syncOn()) pull({ silent:true });
    toast('설정이 끝났습니다');
    go('home');
    fetchRadarFeed({force:true});
    return;
  }
  OB.step = Math.min(OB.step + 1, OB_STEPS.length - 1);
  renderOB();
  $('obBody').scrollTop = 0;
}
$('obNext').onclick = obNext;
$('obBack').onclick = () => { collectOB(); OB.step = Math.max(0, OB.step - 1); renderOB(); };
$('obSkip').onclick = () => { OB.step = Math.min(OB.step + 1, OB_STEPS.length - 1); renderOB(); };
$('editProfileBtn').onclick = () => startOnboarding(true);
$('pdbToggle').onclick = () => {
  const pf = profile(); pf.pdb = !pf.pdb; save(); applyProfileVisibility();
  toast(pf.pdb ? '퍼스널 기업 DB를 켰습니다' : '퍼스널 기업 DB를 껐습니다');
};
$('badgeBtn').onclick = () => toggleAppBadge();

/* ═══════════ 동기화 (종단간 암호화 + CAS) ═══════════
 * · room(동기화 비밀키)을 SHA-256 해시해 row id 로 쓴다
 * · 같은 room 에서 PBKDF2 로 AES-GCM 키를 만들어 상태를 암호화해 올린다
 * · 서버에는 암호문만 남는다. 비밀키를 모르면 아무도 못 읽는다
 * · room 이 곧 사용자 구분자다. 친구는 자기 room 을 만들면 데이터가 완전히 분리된다
 *
 * v7.6 — 시계(updatedAt) 비교를 버리고 revision 기반 상태 머신으로 바꿨다.
 *   PC와 폰의 시계가 다르면 «누가 최신인가» 판단이 틀린다.
 *   baseRev  : 이 기기가 마지막으로 서버와 맞춘 revision (기기마다 다름 → payload 아닌 CFG 에 저장)
 *   dirty    : 그 뒤 로컬에서 바뀐 게 있는지
 *   localGen : save 마다 증가. push 성공 시 «그때 보낸 세대» 와 같을 때만 dirty 를 내린다
 *   pushing  : single-flight. 같은 기기의 두 push 가 같은 expected 로 동시에 날아가는 것을 막는다
 */
let cfg = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(CFG_KEY)) || null;
    if (!s?.room) return null;
    return { url: DEFAULT_SYNC_URL, key: DEFAULT_SYNC_KEY, room: s.room,
             baseRev: Number.isFinite(s.baseRev) ? s.baseRev : 0,
             dirty: !!s.dirty,
             deviceId: s.deviceId || ('d-' + Math.random().toString(36).slice(2,8)) };
  } catch (e) { return null; }
})();
const syncOn = () => !!(cfg && cfg.room);
const saveCfg = () => { try { if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} };

let localGen  = 0;         // save 마다 증가
let syncEpoch = 0;         // 비밀키 변경/해제 때마다 증가. 진행 중이던 옛 요청의 결과를 버리는 데 쓴다
let pushing  = false;      // single-flight
let casMode  = null;       // null=미확인 / true=서버가 CAS 지원 / false=구버전 서버
let syncErr  = false;
let conflictData = null;   // { remoteRev, remoteState, remoteAt }
let syncIssue = null;      // 비밀키·payload를 넣지 않는 내부 진단 정보

class RadarSyncError extends Error {
  constructor(code, phase, message, meta) {
    super(message || code); this.name = 'RadarSyncError';
    this.code = code; this.phase = phase; this.meta = meta || {};
  }
}
const syncError = (code, phase, cause, meta) => {
  if (cause instanceof RadarSyncError) return cause;
  const msg = cause && cause.message ? cause.message : String(cause || code);
  return new RadarSyncError(code, phase, msg, meta);
};
function rememberSyncIssue(err, fallbackPhase) {
  const e = err instanceof RadarSyncError ? err
    : syncError(err instanceof TypeError ? 'network' : 'unknown', fallbackPhase, err);
  syncIssue = { code:e.code, phase:e.phase || fallbackPhase || '',
    status:Number.isFinite(e.meta?.status) ? e.meta.status : null, at:Date.now() };
  // room/secret/payload는 절대 출력하지 않는다. 개발자 도구와 QA 훅에서 원인 종류만 본다.
  console.error('[radar-sync]', syncIssue.code, syncIssue.phase,
    syncIssue.status === null ? '' : syncIssue.status);
  return e;
}
const clearSyncIssue = () => { syncIssue = null; };

/** events만 보면 «프로필은 만들었지만 아직 지원 0건»인 신규 사용자를 빈 데이터로 오판한다. */
function hasLocalSyncData() {
  const pf = state.profile || {};
  return !!(events().length || (state.inbox || []).length || (state.dismissed || []).length
    || (state.qualifications || []).length || (state.outProposals || []).length
    || Object.keys(state.archived || {}).length || Object.keys(state.ignoredOut || {}).length
    || pf.done);
}

/* ── 상태 표시 3단계 (#38) ────────────────────────────────────
 *  ✓ 동기화됨 / ● 변경 N개 미동기화 / ! 실패 — 실패가 성공처럼 보이면 안 된다 */
function setSyncUI(status, text) {
  if (status === undefined) {
    if (!syncOn())      { status = '';    text = '이 기기에만 저장됨'; }
    else if (syncErr)   { status = 'err'; text = '동기화 실패 · 눌러서 다시 시도'; }
    else if (conflictData) { status = 'err'; text = '다른 기기와 충돌 · 눌러서 확인'; }
    else if (cfg.dirty) { status = 'warn'; text = '변경사항 미동기화 · 눌러서 올리기'; }
    else if (casMode === false) { status = 'on'; text = '동기화됨 · 구버전 서버'; }
    else                { status = 'on';   text = `동기화됨 · rev ${cfg.baseRev}`; }
  }
  $('syncDot').className = 'syncdot' + (status ? ' ' + status : '');
  $('syncText').textContent = text;
  const sum=$('syncSum');
  if(sum) sum.textContent=!syncOn()?'선택사항 · 연결 코드로 PC와 휴대폰 연결'
    : syncErr?'연결됨 · 현재 동기화 실패'
    : conflictData?'연결됨 · 다른 기기 변경 확인 필요'
    : cfg.dirty?'연결됨 · 변경사항 올리는 중'
    : `연결됨 · 자동 동기화${cfg.baseRev ? ` · rev ${cfg.baseRev}` : ''}`;
  /* 정상(꺼짐·동기화됨)일 때는 홈에 아무것도 두지 않는다.
     설정 진입은 더보기 → 기기간 동기화 하나로 충분하다. (#3) */
  $('syncBar').hidden = !(status === 'err' || status === 'warn' || status === 'busy');
  $('syncBar').className = 'syncBar' + (status === 'err' ? ' err' : '');
  $('storeLabel').textContent = syncOn()
    ? '데이터가 암호화되어 클라우드에 동기화되고 있습니다. 비밀키는 이 기기에만 있습니다.'
    : '데이터는 이 기기에만 저장됩니다. 동기화를 켜면 PC와 휴대폰이 같은 데이터를 씁니다.';
}
const api = p => `${DEFAULT_SYNC_URL}/rest/v1/${p}`;
const headers = extra => Object.assign({
  apikey: DEFAULT_SYNC_KEY, Authorization: 'Bearer ' + DEFAULT_SYNC_KEY,
  'Content-Type':'application/json' }, extra || {});

const te = new TextEncoder(), td = new TextDecoder();
const b64u = b => {
  let binary='';
  for(let i=0;i<b.length;i+=0x8000) binary+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64u = s0 => {
  const b64 = String(s0).replace(/-/g,'+').replace(/_/g,'/') + '==='.slice((String(s0).length + 3) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};
const hex = b => Array.from(b, v => v.toString(16).padStart(2,'0')).join('');

/** 전역 cfg 를 읽지 않는다. await 사이에 비밀키가 바뀌면 id 와 키가 섞일 수 있다. */
async function syncIdentity(room) {
  try {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
      te.encode('chwijun-radar-room:' + room)));
    const rawKey = await crypto.subtle.importKey('raw', te.encode(room), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name:'PBKDF2', salt: te.encode('chwijun-radar-sync-v1'), iterations:180000, hash:'SHA-256' },
      rawKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
    return { id: hex(digest), key };
  } catch (e) { throw syncError('key-derivation', 'secret', e); }
}
async function seal(obj, room) {
  try {
    const { key } = await syncIdentity(room);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key,
      te.encode(JSON.stringify(obj))));
    return 'v1.' + b64u(iv) + '.' + b64u(cipher);
  } catch (e) { throw syncError(e.code || 'crypto-encrypt', 'encrypt', e); }
}
async function unseal(payload, room) {
  try {
    const [ver, ivs, cts] = String(payload || '').split('.');
    if (ver !== 'v1' || !ivs || !cts) throw new Error('지원하지 않는 동기화 데이터 형식');
    const { key } = await syncIdentity(room);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64u(ivs) }, key, unb64u(cts));
    return JSON.parse(td.decode(plain));
  } catch (e) { throw syncError(e.code || 'crypto-decrypt', 'decrypt', e); }
}

/** 서버에서 읽는다. { rev, at, state } 또는 null(아직 없음) */
async function remoteRead(room) {
  const { id } = await syncIdentity(room);
  let r;
  try { r = await fetch(api('rpc/radar_get'), {
    method:'POST', headers: headers(), cache:'no-store', body: JSON.stringify({ p_id:id }) }); }
  catch (e) { throw syncError('network', 'pull', e); }
  if (!r.ok) throw syncError('rpc', 'radar_get', new Error(await r.text()), { status:r.status });
  let rows;
  try { rows = await r.json(); }
  catch (e) { throw syncError('rpc', 'radar_get-response', e, { status:r.status }); }
  if (!Array.isArray(rows) || !rows.length) { if (casMode === null) casMode = true; return null; }
  const row = rows[0];
  if (casMode === null) casMode = Number.isFinite(row.revision);   // 구버전 서버는 revision 이 없다
  return { rev: Number.isFinite(row.revision) ? row.revision : 0,
           at: row.updated_at || null,
           state: await unseal(row.payload, room) };
}

/** CAS 쓰기. { status:'ok'|'conflict', rev, at, state? } */
async function remoteWrite(expectedRev, room, payloadState = state) {
  const { id } = await syncIdentity(room);
  const payload = await seal(payloadState, room);
  const body = { p_id:id, p_payload:payload };
  if (casMode !== false) body.p_expected_revision = expectedRev;

  let r;
  try { r = await fetch(api('rpc/radar_put'), {
    method:'POST', headers: headers(), body: JSON.stringify(body) }); }
  catch (e) { throw syncError('network', expectedRev === 0 ? 'first-push' : 'push', e); }

  // 서버가 아직 구버전(2-arg)이면 함수를 못 찾는다 → 한 번만 레거시로 재시도
  if (!r.ok && casMode !== false && (r.status === 404 || r.status === 400)) {
    const t = await r.text();
    if (/PGRST202|does not exist|not unique|Could not find/i.test(t)) {
      casMode = false;
      try { r = await fetch(api('rpc/radar_put'), {
        method:'POST', headers: headers(), body: JSON.stringify({ p_id:id, p_payload:payload }) }); }
      catch (e) { throw syncError('network', expectedRev === 0 ? 'first-push-legacy' : 'push-legacy', e); }
    } else throw syncError(expectedRev === 0 ? 'room-create' : 'rpc', 'radar_put', new Error(t),
      { status:r.status, cause:'rpc' });
  }
  if (!r.ok) throw syncError(expectedRev === 0 ? 'room-create' : 'rpc',
    casMode === false ? 'radar_put-legacy' : 'radar_put', new Error(await r.text()),
    { status:r.status, cause:'rpc' });

  let rows;
  try { rows = await r.json(); }
  catch (e) { throw syncError('rpc', 'radar_put-response', e, { status:r.status }); }
  const row = Array.isArray(rows) ? rows[0] : rows;
  // 구버전 서버는 revision 개념이 없다. 가짜 rev 를 만들면 다음 pull 이 역행으로 오판한다.
  if (!row || !row.status) return { status:'ok', rev: 0, at:null };
  if (row.status === 'conflict') {
    let remoteState = null;
    if (row.payload) {
      try { remoteState = await unseal(row.payload, room); }
      catch (e) { throw syncError(e.code || 'crypto-decrypt', 'conflict-decrypt', e); }
    }
    return { status:'conflict', rev: row.revision, at: row.updated_at,
             state:remoteState };
  }
  return { status:'ok', rev: row.revision, at: row.updated_at };
}

/** 요청 시작 시점의 비밀키·epoch 과 지금이 다른가 (다르면 응답을 버려야 한다) */
const staleSync = (room, epoch) => !cfg || cfg.room !== room || syncEpoch !== epoch;

/** 로컬 변경을 서버에 올린다. single-flight. */
async function push({ silent } = {}) {
  if (!syncOn() || pushing || conflictData) return;
  const room = cfg.room, epoch = syncEpoch;
  pushing = true;
  const genAtStart = localGen, snapshot=structuredClone(state);
  setSyncUI('busy','올리는 중…');
  try {
    const res = await remoteWrite(cfg.baseRev || 0, room, snapshot);
    if (staleSync(room, epoch)) return;          // 올리는 사이 비밀키가 바뀌었다 → 결과 폐기
    if (res.status === 'conflict') {
      conflictData = { remoteRev: res.rev, remoteState: res.state, remoteAt: res.at };
      syncIssue = { code:'conflict', phase:'push', status:null, at:Date.now() };
      syncErr = false; setSyncUI();
      if (!silent) openConflict();
      return;
    }
    cfg.baseRev = res.rev;
    if (localGen === genAtStart) cfg.dirty = false;   // 올리는 사이에 또 고쳤으면 dirty 유지
    saveCfg(); syncErr = false; clearSyncIssue(); setSyncUI();
    if (localGen !== genAtStart) schedulePush();      // 남은 변경을 이어서 올린다
  } catch (e) {
    if (!staleSync(room, epoch)) { rememberSyncIssue(e, 'push'); syncErr = true; setSyncUI(); }
    if (!silent) toast('동기화 실패 — 네트워크를 확인해줘');
  } finally {
    pushing = false;
    // 이전 room 요청이 끝난 뒤에는 새 room의 최초 pull/push를 자동으로 이어간다.
    if(syncOn()&&staleSync(room,epoch)) queueMicrotask(()=>pull({silent:true}));
  }
}

/** 서버를 확인해 방향을 정한다. 시계가 아니라 revision 으로 판단한다. */
async function pull({ silent } = {}) {
  if (!syncOn() || pushing || conflictData) return;
  const room = cfg.room, epoch = syncEpoch;
  setSyncUI('busy','확인 중…');
  try {
    const remote = await remoteRead(room);
    if (staleSync(room, epoch)) return;          // 확인하는 사이 비밀키가 바뀌었다 → 결과 폐기

    // ── 구버전 서버: revision 이 없으므로 상태 머신을 타지 않는다 ──
    if (casMode === false) {
      if (!remote) {
        if (cfg.dirty || hasLocalSyncData()) { await push({ silent }); }
        else { syncErr = false; clearSyncIssue(); setSyncUI(); }
        return;
      }
      if (cfg.dirty) { await push({ silent }); return; }        // 예전 방식(LWW)
      if (JSON.stringify(remote.state) !== JSON.stringify(state)) {
        if (applyRemote(remote.state, 0) && !silent) toast('다른 기기의 최신 데이터를 가져왔습니다');
      } else { syncErr = false; clearSyncIssue(); setSyncUI(); }
      return;
    }

    if (!remote) {                                   // 서버에 아직 없다
      if (cfg.dirty || hasLocalSyncData()) { cfg.baseRev = 0; saveCfg(); await push({ silent }); }
      else { syncErr = false; clearSyncIssue(); setSyncUI(); }
      return;
    }
    if (remote.rev === cfg.baseRev) {
      if (cfg.dirty) await push({ silent });
      else { syncErr = false; clearSyncIssue(); setSyncUI(); }
      return;
    }
    if (remote.rev > cfg.baseRev) {
      if (cfg.dirty) {                               // 양쪽이 바뀌었다 → 덮어쓰지 않는다
        conflictData = { remoteRev: remote.rev, remoteState: remote.state, remoteAt: remote.at };
        syncIssue = { code:'conflict', phase:'pull', status:null, at:Date.now() };
        syncErr = false; setSyncUI();
        if (!silent) openConflict();
        return;
      }
      if (applyRemote(remote.state, remote.rev) && !silent) toast('다른 기기의 최신 데이터를 가져왔습니다');
      return;
    }
    // remote.rev < baseRev — 서버가 초기화됐거나 비정상. 자동으로 덮지 않는다.
    syncIssue = { code:'cas-revision', phase:'pull', status:null, at:Date.now() };
    syncErr = true;
    setSyncUI('err','서버 데이터가 더 오래됐습니다 · 눌러서 확인');
  } catch (e) {
    if (staleSync(room, epoch)) return;
    rememberSyncIssue(e, 'pull'); syncErr = true; setSyncUI();
    if (!silent) toast('동기화 실패');
  }
}

/** 원격 데이터를 이 기기에 적용한다.
 *  저장에 실패하면 baseRev 를 절대 올리지 않는다.
 *  올려버리면 «디스크는 옛 데이터인데 cfg 는 최신 rev» 가 되어,
 *  다음 실행에서 remoteRev === baseRev 로 보고 다시 받아오지 않는다.
 *  @returns {boolean} 실제로 저장까지 성공했는가 */
function applyRemote(remoteState, rev) {
  checkpoint('sync-pull');
  const prev = state;
  state = migrate({ axes:{}, ...remoteState });

  if (!persist()) {
    state = prev;                       // 디스크와 메모리를 다시 일치시킨다
    syncIssue = { code:'local-persist', phase:'pull-apply', status:null, at:Date.now() };
    syncErr = true;
    render();
    setSyncUI('err', '가져온 데이터를 이 기기에 저장하지 못했습니다 · 눌러서 다시 시도');
    return false;
  }

  cfg.baseRev = rev; cfg.dirty = false; saveCfg();
  syncErr = false; clearSyncIssue();
  render(); setSyncUI();
  return true;
}

let pushTimer;
function schedulePush() {
  if (!syncOn()) return;
  cfg.dirty = true; localGen++; saveCfg(); setSyncUI();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push({ silent:true }), 700);
}

/* ── 충돌 2지선다 ─────────────────────────────────────────────
 * 3-way merge 는 만들지 않는다. 이 규모에서 과설계다.
 * 사용자가 «덮어쓰기» 를 한 번 고르면 CAS 를 한 번만 시도한다.
 * 그 사이 또 바뀌면 자동 재시도하지 않고 새 충돌 화면을 다시 띄운다. */
const cntOf = st => {
  const ev = (st && Array.isArray(st.events)) ? st.events : [];
  return { co: new Set(ev.map(e => e.company).filter(Boolean)).size, ev: ev.length };
};
function openConflict() {
  if (!conflictData) return;
  const mine = cntOf(state), theirs = cntOf(conflictData.remoteState);
  const at = conflictData.remoteAt ? new Date(conflictData.remoteAt).toLocaleString('ko-KR') : '시각 알 수 없음';
  $('cfBody').innerHTML = `
    <p class="lead lead--tight">다른 기기에서도 데이터가 바뀌었습니다. 한쪽을 골라주세요.<br>
    고른 뒤에도 되돌릴 수 있게 양쪽 사본을 남깁니다.</p>
    <div class="cfSide">
      <b>이 기기</b>
      <span>지원 기업 ${mine.co}곳 · 일정 ${mine.ev}건</span>
    </div>
    <div class="cfSide">
      <b>다른 기기 <i>rev ${conflictData.remoteRev}</i></b>
      <span>${esc(at)} 저장 · 지원 기업 ${theirs.co}곳 · 일정 ${theirs.ev}건</span>
    </div>`;
  openSheet('cfBg');
}
$('cfUseRemote').onclick = async () => {
  if (!conflictData) return;
  const d = conflictData; conflictData = null;
  closeSheet('cfBg');
  if (!d.remoteState) { toast('다른 기기 데이터를 읽지 못했습니다'); syncErr = true; setSyncUI(); return; }
  if (applyRemote(d.remoteState, d.remoteRev)) toast('다른 기기 데이터로 맞췄습니다');
  else toast('저장에 실패해 적용하지 못했습니다');
};
$('cfUseLocal').onclick = async () => {
  if (!conflictData) return;
  const d = conflictData; conflictData = null;
  closeSheet('cfBg');
  checkpoint('sync-overwrite');
  cfg.baseRev = d.remoteRev; saveCfg();          // 이 충돌에서 받은 revision 으로 딱 1회
  const room = cfg.room, epoch = syncEpoch;
  pushing = true;
  const genAtStart = localGen;
  setSyncUI('busy','올리는 중…');
  try {
    const res = await remoteWrite(d.remoteRev, room);
    if (staleSync(room, epoch)) return;
    if (res.status === 'conflict') {             // 그 사이 또 바뀌었다 → 자동 재시도 금지
      conflictData = { remoteRev: res.rev, remoteState: res.state, remoteAt: res.at };
      syncIssue = { code:'conflict', phase:'overwrite', status:null, at:Date.now() };
      setSyncUI(); openConflict();
      toast('그 사이 다른 기기에서 또 변경되었습니다');
      return;
    }
    cfg.baseRev = res.rev;
    if (localGen === genAtStart) cfg.dirty = false;
    saveCfg(); syncErr = false; clearSyncIssue(); setSyncUI();
    toast('이 기기 데이터로 올렸습니다');
    // 덮어쓰는 사이에 또 저장했다면 그 변경도 이어서 올린다.
    // (일반 push 에는 있는데 여기 빠져 있어서, 덮어쓰기 중 저장분이 안 올라갈 수 있었다)
    if (localGen !== genAtStart) schedulePush();
  } catch (e) {
    if (!staleSync(room, epoch)) { rememberSyncIssue(e, 'overwrite'); syncErr = true; setSyncUI(); }
    toast('올리지 못했습니다');
  } finally { pushing = false; }
};
$('cfCancel').onclick = () => { closeSheet('cfBg'); setSyncUI(); };

const randomRoom = () => 'jr-' + b64u(crypto.getRandomValues(new Uint8Array(24)));
const encodePairing = c => b64u(te.encode(JSON.stringify({ v:1, room:c.room })));
function decodePairing(code) {
  const j = JSON.parse(td.decode(unb64u(String(code||'').trim())));
  if (!j || !j.room) throw new Error('연결 코드 형식 오류');
  return { room: String(j.room).trim() };
}

function openSync() {
  $('sRoom').value = cfg?.room || randomRoom();
  if ($('sPair')) $('sPair').value = '';
  openSheet('syncBg');
}
$('syncBtn').onclick = () => { if (conflictData) openConflict(); else openSync(); };

$('syncCancel').onclick = () => closeSheet('syncBg');
$('syncOff').onclick = () => {
  cfg = null; localStorage.removeItem(CFG_KEY); closeSheet('syncBg');
  syncEpoch++; conflictData = null; syncErr = false;
  setSyncUI(); toast('동기화를 껐습니다');
};
$('syncGen').onclick = () => { $('sRoom').value = randomRoom(); toast('새 비밀키를 만들었습니다'); };
$('syncCopy').onclick = async () => {
  const room = $('sRoom').value.trim();
  if (!room) { alert('먼저 동기화 비밀키를 만들어줘'); return; }
  const code = encodePairing({ room });
  try { await navigator.clipboard.writeText(code); toast('연결 코드 복사 · 다른 기기에 붙여넣으세요'); }
  catch { prompt('아래 연결 코드를 다른 기기에 붙여넣으세요', code); }
};
$('syncPairApply').onclick = () => {
  try { $('sRoom').value = decodePairing($('sPair').value).room; toast('연결 코드를 불러왔습니다'); }
  catch (e) { alert('연결 코드를 확인해줘'); }
};
$('syncSave').onclick = async () => {
  const room = $('sRoom').value.trim();
  if (!room) { alert('동기화 비밀키가 필요해'); return; }
  if (room.length < 20) { alert('비밀키는 20자 이상이어야 해. “새 비밀키 만들기”를 눌러줘.'); return; }
  const same = cfg && cfg.room === room;
  cfg = { url: DEFAULT_SYNC_URL, key: DEFAULT_SYNC_KEY, room,
          baseRev: same ? cfg.baseRev : 0,
          dirty:   same ? cfg.dirty : events().length > 0,
          deviceId: (cfg && cfg.deviceId) || ('d-' + Math.random().toString(36).slice(2,8)) };
  saveCfg(); syncEpoch++; conflictData = null; syncErr = false;
  closeSheet('syncBg'); await pull();
  if (OB.restoring) {
    if (profile().done) {
      OB.restoring = false; endOnboarding(); render(); go('home');
      toast(`기존 Radar를 불러왔습니다 · 지원 ${groups().length}건`);
      return;
    }
    toast('그 키에는 저장된 Radar가 없습니다 — 새로 만들거나 다른 키를 넣어주세요');
    return;
  }
  toast('암호화 동기화 연결 완료');
};
/* 배너는 «상태 알림 + 그 상태를 푸는 버튼» 하나다.
   충돌 → 충돌 시트, 미동기화 → 올리기, 실패 → 재시도, 꺼짐 → 설정 */
$('syncBar').onclick = () => {
  if (conflictData) { openConflict(); return; }
  if (!syncOn()) { openSync(); return; }
  syncErr = false;
  if (cfg && cfg.dirty) push(); else pull();
};

/* ═══════════ PWA ═══════════ */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  if (cur === 'home') $('installBtn').hidden = false;
});
$('installBtn').onclick = async () => {
  if (!deferredPrompt) {
    alert('iPhone Safari: 공유 → 홈 화면에 추가\nAndroid Chrome: ⋮ → 앱 설치\nPC Chrome/Edge: 주소창 오른쪽 설치 아이콘');
    return;
  }
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; $('installBtn').hidden = true;
};
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('설치 완료'); });

let swRegistration = null;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache:'none' }).then(reg => {
      swRegistration = reg;
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('새 버전을 적용하는 중…');
          }
        });
      });
    }).catch(() => {});
  });
  // 구버전 CSS/JS 혼용을 막기 위한 1회 자동 새로고침.
  // 첫 설치(=controller 없음)에서는 새로고침하지 않는다. 하면 무한 리로드가 된다.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true; location.reload();
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (swRegistration) swRegistration.update().catch(() => {});
    pull({ silent:true }); fetchRadarFeed();
  }
});
// 설치형 PWA를 오래 열어둔 경우에도 다음 배포를 놓치지 않는다.
setInterval(() => {
  if (document.visibilityState === 'visible' && swRegistration) swRegistration.update().catch(() => {});
}, 30 * 60 * 1000);
window.addEventListener('online', () => { pull({ silent:true }); fetchRadarFeed({force:true}); });

/* ═══════════ 시작 ═══════════ */
persist();
refreshRecoveryUI();
setSyncUI();
applyProfileVisibility();
render();
go('home');
if (!profile().done) startOnboarding(false);
else if (syncOn()) pull({ silent:true });
if (profile().done) fetchRadarFeed({force:true});

/* ═══════════ 어학·자격 편집 (v8.1) ═══════════ */

function qualSummary() {
  const qs = quals();
  if (!qs.length) return '등록된 성적이 없습니다';
  return qs.map(q => {
    const st = qualStatus(q);
    const v = q.grade || (q.score !== null && q.score !== '' ? q.score : '');
    return `${q.type}${v ? ' ' + v : ''}${st === 'valid' ? '' : ` (${QUAL_STATUS_LABEL[st]})`}`;
  }).join(' · ');
}

function renderQuals() {
  const qs = quals();
  $('qualList').innerHTML = qs.map((q, i) => {
    const st = qualStatus(q);
    return `<div class="qCard">
      <div class="qHead">
        <select class="qIn" data-q="${i}" data-f="type">${QUAL_TYPES.map(t =>
          `<option${t === q.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <span class="statusChip ${st === 'valid' ? 'is-done'
          : st === 'pending' ? 'is-hold' : st === 'needsInput' ? 'is-hold' : 'is-fail'}">${
          QUAL_STATUS_LABEL[st]}</span>
        <button class="qDel" data-del="${i}" aria-label="삭제">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="qGrid">
        <label><span>등급 (AL·IM3 등)</span>
          <input class="qIn" data-q="${i}" data-f="grade" value="${esc(q.grade || '')}"
            placeholder="결과 전이면 비워두세요" autocapitalize="characters"></label>
        <label><span>점수</span>
          <input class="qIn" data-q="${i}" data-f="score" value="${q.score === null ? '' : esc(String(q.score))}"
            placeholder="숫자 시험만" inputmode="decimal"></label>
        <label><span>시험일</span>
          <input class="qIn" type="date" data-q="${i}" data-f="testDate" value="${esc(q.testDate || '')}"></label>
        <label><span>결과 발표일</span>
          <input class="qIn" type="date" data-q="${i}" data-f="resultDate" value="${esc(q.resultDate || '')}"></label>
        <label><span>유효기간 만료</span>
          <input class="qIn" type="date" data-q="${i}" data-f="validUntil" value="${esc(q.validUntil || '')}"></label>
      </div>
    </div>`;
  }).join('') || '<div class="emptyState">아직 등록한 성적이 없습니다.</div>';

  qsa('.qIn').forEach(el => el.onchange = () => {
    const q = quals()[+el.dataset.q]; if (!q) return;
    const f = el.dataset.f, v = el.value.trim();
    if (f === 'score') q.score = v === '' ? null : (Number(v) || null);
    else if (f === 'grade') q.grade = v === '' ? null : v.toUpperCase();
    else q[f] = v;
    save();                       // 결과가 들어오면 모든 공고의 판정이 저절로 다시 계산된다
    renderQuals(); $('qualSum').textContent = qualSummary();
  });
  qsa('[data-del]').forEach(b => b.onclick = () => {
    const i = +b.dataset.del, gone = quals()[i];
    quals().splice(i, 1); save(); renderQuals(); $('qualSum').textContent = qualSummary();
    undoBar('성적을 지웠습니다', () => { quals().splice(i, 0, gone); save(); renderQuals();
      $('qualSum').textContent = qualSummary(); });
  });
}
$('qualBtn').onclick = () => { renderQuals(); openSheet('qualBg'); };
$('qualClose').onclick = () => closeSheet('qualBg');
$('qualAdd').onclick = () => {
  quals().push({ id:'q-'+Math.random().toString(36).slice(2,8), type:'TOEIC Speaking',
    score:null, grade:null, testDate:'', resultDate:'', validUntil:'' });
  save(); renderQuals(); $('qualSum').textContent = qualSummary();
};

/** 종료 제안을 «무시» 한 근거. 이 값이 그대로면 같은 제안을 다시 띄우지 않는다.
 *  지원 상태 · 다음 전형 · 어학 판정 · 공고 주소 — 하나라도 바뀌면 판단이 달라질 수 있다. */
function outBasis(g) {
  const e = g.english ? evaluateEligibility(g.english, quals()).verdict : 'none';
  return [g.status, g.hold ? 'hold' : '-',
          g.next ? `${g.next.stage}@${g.next.date}` : 'none',
          e, g.url || '-'].join('|');
}

/** 공고 하나의 어학 판정 배지. UI 와 프롬프트가 같은 계산기를 쓴다. */
function eligBadge(reqText) {
  const e = evaluateEligibility(reqText, quals());
  if (e.verdict === 'ok' && e.reason === '어학 요건 없음') return '';
  return `<span class="egBadge ${VERDICT_CLS[e.verdict]}" title="${esc(e.reason)}">${esc(e.label)}</span>`;
}

/* ══════════════════════════════════════════════════════════════
   ?ui=1 — 컴포넌트 상태 matrix
   정상 샘플 하나만 보면 실제 데이터에서 깨진다. 여기서 edge case 를 고정한다.
   ══════════════════════════════════════════════════════════════ */
function renderUiGallery() {
  const mk = (o) => Object.assign({ id:'g'+Math.random().toString(36).slice(2,7),
    company:'현대카드', role:'카드상품기획', tier:'S', status:'', date: todayStr(),
    time:'10:00', stage:'apply', kind:'deadline', result:'', hold:false,
    progress:0, english:'', note:'', url:'' }, o);
  const far = (n) => { const d = new Date(); d.setDate(d.getDate()+n);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };

  const sec = (t, body) => `<div class="uiSec"><h3>${t}</h3><div class="uiBox">${body}</div></div>`;
  let h = '<div class="uiHead"><b>취준 Radar — 컴포넌트 상태 matrix</b>'
        + '<span>실제 렌더 함수로 그린다. 여기서 안 깨지면 화면에서도 안 깨진다.</span></div>';

  h += sec('StageBadge · 8종', STAGES.map(s =>
    `<span class="stageBadge ${s.cls}">${esc(s.label)}</span>`).join(' '));

  h += sec('TierMark · 4종 (색 금지)', ['S+','S','A+','A','WATCH'].map(t =>
    `<span class="tierMark ${tierCls(t)}">${esc(t)}</span>`).join(' '));

  h += sec('StatusChip · 5종', [['','지원예정'],['is-live','검사·면접'],['is-done','최종합격'],
    ['is-fail','불합격'],['is-hold','보류']].map(([c,t]) =>
    `<span class="statusChip ${c}">${t}</span>`).join(' '));

  h += sec('EventRow · up (홈) — 오늘/임박/여유/과거/종료', `<div class="evList">
    ${eventRow(mk({ company:'SK하이닉스', role:'영업/마케팅/상품기획/신제품사업화',
                    tier:'S+', stage:'test', time:'09:00' }), 'up')}
    ${eventRow(mk({ date: far(2) }), 'up')}
    ${eventRow(mk({ company:'롯데칠성음료', date: far(9), time:'' }), 'up')}
    ${eventRow(mk({ company:'한화생명', tier:'A', date: far(-4), result:'fail' }), 'up')}
    ${eventRow(mk({ company:'TOEIC Speaking', role:'TOEIC Speaking', tier:'A', stage:'cert' }), 'up')}
  </div>`);

  h += sec('EventRow · cal (캘린더) — 긴 직무 2줄 / 시간 미정 / 결과 입력됨', `<div class="evList">
    ${eventRow(mk({ company:'SK하이닉스', role:'영업/마케팅/상품기획/신제품사업화',
                    tier:'S+', stage:'test', time:'09:00' }), 'cal')}
    ${eventRow(mk({ time:'' }), 'cal')}
    ${eventRow(mk({ company:'롯데웰푸드', role:'상품기획', stage:'result',
                    result:'pass', date: far(-3) }), 'cal')}
  </div>`);

  h += sec('AppCard · 진행/임박/보류/종료/불합격', ['normal','urgent','hold','archived','fail']
    .map(k => {
      const base = { key:'k'+k, company:{normal:'기아',urgent:'현대카드',hold:'제일기획',
        archived:'롯데웰푸드',fail:'한화생명'}[k], role:'전략기획',
        tier:{normal:'S',urgent:'S',hold:'A',archived:'S',fail:'A'}[k],
        status:'지원완료', isCert:false, waitDays:0,
        closed:k==='fail', won:false, hold:k==='hold', archived:k==='archived',
        dropped:k==='fail'||k==='archived', items:[], pending:null,
        next: k==='archived'||k==='fail' ? null
              : mk({ date: k==='urgent' ? todayStr() : far(6), stage:'interview' }) };
      const u = base.next ? urgency(base.next) : null;
      const chip = base.archived ? {cls:'is-fail',txt:'종료'} : base.closed ? {cls:'is-fail',txt:'불합격'}
        : base.hold ? {cls:'is-hold',txt:'보류'} : {cls:'is-live',txt:'검사·면접'};
      return `<div class="appCard ${impCls(base.tier,false)} ${base.dropped?'is-dropped':''}">
        <button class="acHit">
          <span class="acTop"><span class="acCo">${esc(base.company)}</span>
            <span class="tierMark ${tierCls(base.tier)}">${esc(base.tier)}</span></span>
          <span class="acRole">${esc(base.role)}</span>
          <span class="acMeta"><span class="statusChip ${chip.cls}">${chip.txt}</span>${
            base.next ? `<span class="acNext">면접 ${fmt(base.next)}</span>` : ''}${
            u && !base.closed && !base.hold && !base.archived
              ? `<b class="acDd ${u.cls}">${esc(u.text)}</b>` : ''}</span>
        </button></div>`;
    }).join(''));

  h += sec('MenuRow · lead / 기본 / 위험', `
    <button class="row rowBtn rowLead"><div class="rowMain"><div class="rowT">휴대폰과 연결</div>
      <div class="rowS">연결 코드로 PC와 휴대폰 데이터를 맞춥니다</div></div><span class="chev"></span></button>
    <button class="row rowBtn"><div class="rowMain"><div class="rowT">백업 내려받기</div>
      <div class="rowS">JSON 파일로 저장</div></div><span class="chev"></span></button>
    <button class="row rowBtn danger"><div class="rowMain"><div class="rowT">완전 초기화</div>
      <div class="rowS">설문·동기화 설정까지 전부 지웁니다</div></div><span class="chev"></span></button>`);

  h += sec('NoticeBar · 미동기화 / 실패 / 검토함', `
    <div class="syncBar is-warn" style="position:static"><span class="syncdot warn"></span>
      <span class="syncBarT">변경사항 미동기화 · 눌러서 올리기</span><span class="chev"></span></div>
    <div class="syncBar err" style="position:static"><span class="syncdot err"></span>
      <span class="syncBarT">동기화 실패 · 눌러서 다시 시도</span><span class="chev"></span></div>
    <div class="banner">검토할 새 공고가 3건 있습니다<button>보기</button></div>`);

  h += sec('EmptyState / Button', `
    <div class="empty"><b>지원 건이 없습니다</b>오른쪽 위 + 로 직접 추가하세요.</div>
    <div style="display:flex;gap:8px;padding:0 20px 16px">
      <button class="btn btnPrimary grow">저장</button>
      <button class="btn btnGhost">취소</button>
      <button class="btn btnGhost danger">삭제</button></div>`);

  document.body.innerHTML = `<div class="uiGallery">${h}</div>`;
}
if (new URLSearchParams(location.search).get('ui') === '1') {
  window.addEventListener('load', () => setTimeout(renderUiGallery, 60));
}

})();
