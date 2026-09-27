import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright` : 'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const p = await ctx.newPage();
p.route('http://127.0.0.1:8878/rest/v1/radar_feed_items**', r => r.fulfill({status:200,contentType:'application/json',body:'[]'}));
p.route('http://127.0.0.1:8878/rest/v1/radar_feed_status**', r => r.fulfill({status:200,contentType:'application/json',body:'[]'}));
p.on('pageerror', e => errs.push('PE: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_CONNECTION_RESET')) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => {
  const cur = localStorage.getItem('jobRadarStateV3');
  if (!cur) localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[], axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{ done:true, pdb:true, name:'회귀', jobs:[], axisOrder:[], criteria:{}, 
      excludeCompanies:['APR'], excludeRoles:[], strength:'', want:'', avoid:'', prompt:'x', createdAt:Date.now() }
  }));
});
await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(700);

// 시드 주입 (신규 사용자용 접힌 도움말)
await p.click('.tab[data-tab="more"]'); await p.click('#utilityZone > summary'); await p.click('#seedBtn'); await p.waitForTimeout(700);
R['01_시드'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);

// 홈
await p.click('.tab[data-tab="home"]'); await p.waitForTimeout(300);
R['02_다음할일'] = (await p.textContent('#nextAction')).replace(/\s+/g,' ').trim().slice(0,45);
R['03_퍼널'] = await p.$$eval('.fstat', n => n.map(x => x.querySelector('span').textContent+':'+x.querySelector('b').textContent).join(' '));
R['04_그다음일정'] = (await p.$$('#upcoming .evRow')).length;
R['04b_히어로중복없음'] = await p.evaluate(() => {
  const hero = document.querySelector('.heroTitle')?.textContent.trim();
  return hero ? ![...document.querySelectorAll('#upcoming .evCo')].some(x => x.textContent.trim() === hero) : 'no-hero'; });

// 캘린더 + 날짜시트 + 월이동
await p.click('.tab[data-tab="cal"]'); await p.waitForTimeout(300);
R['05_9월점'] = (await p.$$('.cdot')).length;
R['05b_회사명pill제거'] = (await p.$$('#calendar .pill, #calendar .pco')).length === 0;
await p.click('#prevMonth'); await p.waitForTimeout(250);
R['06_8월(하이닉스서류)'] = await p.evaluate(() =>
  [...document.querySelectorAll('#calendar .cdot')].some(d => (d.title||'').includes('SK하이닉스')));
await p.click('#nextMonth'); await p.waitForTimeout(250);
// 누르지 않아도 그 달 일정이 목록으로 보여야 한다
R['07_월목록_행수'] = (await p.$$('#calList .evRow')).length;
R['07b_월목록_정보'] = (await p.textContent('#calList')).replace(/\s+/g,' ').trim().slice(0,70);
await p.evaluate(() => { const f = document.querySelector('#calList .pastFold'); if (f) f.open = true; });
await p.click('.day[data-day="2026-09-14"]'); await p.waitForTimeout(500);
R['07c_날짜누르면_그날로'] = await p.evaluate(() =>
  !!document.getElementById('cd-2026-09-14'));

// 지원: 결과 입력 흐름
await p.evaluate(() => {   // 검사 일정을 과거로
  const s = JSON.parse(localStorage.getItem('jobRadarStateV3'));
  s.events.find(e => e.company==='SK하이닉스' && e.stage==='test').date = '2026-09-04';
  localStorage.setItem('jobRadarStateV3', JSON.stringify(s));
});
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
R['08_결과요청줄'] = await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.textContent.includes('SK하이닉스'));
  const a=r?.querySelector('.askRes'); return a ? a.textContent.replace(/\s+/g,' ').trim() : 'none'; });
await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.textContent.includes('SK하이닉스'));
  r.querySelector('[data-val="pass"]').click(); });
await p.waitForTimeout(900);
// 통과하면 '다음 전형 등록' 시트가 열린다(의도된 동작) → 닫고 계속
R['09b_다음전형시트'] = await p.$eval('#modalBg', e => e.classList.contains('open'));
if (R['09b_다음전형시트']) { await p.click('#cancelBtn'); await p.waitForTimeout(400); }
R['09_통과후상태'] = await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.querySelector('.acCo')?.textContent.trim()==='SK하이닉스');
  return r.querySelector('.acMeta').textContent.replace(/\s+/g,' ').trim().slice(0,20); });

// 보류 토글
await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.querySelector('.acCo')?.textContent.trim()==='현대카드');
  r.querySelector('.acHit').click(); });
await p.waitForTimeout(500);
await p.click('#apHold'); await p.waitForTimeout(500);
await p.click('#apClose'); await p.waitForTimeout(400);
await p.waitForTimeout(600);
R['10_보류'] = await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.querySelector('.acCo')?.textContent.trim()==='현대카드');
  return r.querySelector('.acMeta').textContent.trim().split(' ')[0]; });

// 지원 건 통째 삭제
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
await p.evaluate(() => { const r=[...document.querySelectorAll('.appCard')].find(x=>x.querySelector('.acCo')?.textContent.trim()==='롯데GRS');
  r.querySelector('.acHit').click(); });
await p.waitForTimeout(500);
await p.click('#apMore'); await p.waitForTimeout(300);   // 완전 삭제는 «···» 안으로 옮겼다
await p.click('#apDelete');
await p.waitForTimeout(700);
R['11_그룹삭제'] = before + '→' + (await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length));

// 일정 추가 (시트)
await p.click('#addBtn'); await p.waitForTimeout(400);
await p.fill('#fcompany','회귀테스트'); await p.fill('#frole','전략기획');
await p.fill('#fdate','2026-09-26'); await p.selectOption('#fstage','interview');
R['12_결과옵션'] = await p.$$eval('#fresult option', o => o.map(x=>x.textContent).join('/'));
await p.click('.sheetFoot .btnPrimary'); await p.waitForTimeout(700);
R['13_추가됨'] = (await p.textContent('#appCards')).includes('회귀테스트');

// 검토함 가져오기
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(250);
await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify([
 {company:'한화생명',role:'서비스/사업기획',tier:'S',jd:'신규 서비스 기획',require:'전공 무관',
  english:'마감일까지 유효 성적',note:'사업기획 직접적',url:'',schedule:[{stage:'apply',date:'2026-09-18',time:'15:00'}]},
 {company:'APR',role:'전략기획',tier:'S+',schedule:[{stage:'apply',date:'2026-09-30',time:''}]}]));
await p.click('#impRun'); await p.waitForTimeout(900);
R['14_검토함'] = (await p.$$('.inCard')).length;
R['15_APR차단'] = !(await p.textContent('#inboxList')).includes('APR');
R['16_배지'] = await p.textContent('#tabBadge');
// 일정 칩 끄고 추가
await p.click('.inCard [data-accept]'); await p.waitForTimeout(800);
R['17_수락후검토함'] = (await p.$$('.inCard')).length;
R['18_지원목록에한화'] = await (async()=>{ await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
  return (await p.textContent('#appCards')).includes('한화생명'); })();

// 퍼스널 DB + 평가축
await p.click('.tab[data-tab="more"]'); await p.click('[data-go="db"]'); await p.waitForTimeout(500);
R['19_DB건수'] = (await p.$$('.dbRow')).length;
await p.click('.dbRow .axesToggle'); await p.waitForTimeout(250);
await p.click('.dbRow .axes.open .axDot:nth-child(4)'); await p.waitForTimeout(500);
R['20_평가축'] = (await p.textContent('.dbRow .dbMeta')).includes('내 평가');

// 동기화 시트
await p.click('#backBtn'); await p.waitForTimeout(250);
await p.click('#syncBtn'); await p.waitForTimeout(400);
await p.click('#syncGen'); await p.waitForTimeout(300);
R['21_비밀키길이'] = (await p.inputValue('#sRoom')).length;
await p.click('#syncCancel'); await p.waitForTimeout(300);

// 백업 왕복
R['22_백업버튼'] = (await p.$$('#exportBtn')).length === 1;

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

