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
const ev = (id,co,stage,date,time,result,tier) => ({id,company:co,role:'전략기획',tier:tier||'A',status:'',
  date,time:time||'',stage,kind:'deadline',result:result||'',hold:false,progress:0,english:'',note:'',url:''});
await p.addInitScript(() => {
  const ev = (id,co,stage,date,time,result,tier) => ({id,company:co,role:'전략기획',tier:tier||'A',status:'',
    date,time:time||'',stage,kind:'deadline',result:result||'',hold:false,progress:0,english:'',note:'',url:''});
  const t = new Date(); const pad = n => String(n).padStart(2,'0');
  const todayStr = `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
  const soon = new Date(Date.now()+3*3600000);
  const soonT = `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[
      ev('p1','결과밀림','test','2026-09-01','', '', 'A'),
      ev('p0','결과밀림','apply','2026-08-20','','pass','A'),
      ev('u1','오늘마감','apply', todayStr, soonT, '', 'S'),
      ev('f1','먼날짜','apply','2026-12-01','','','S+'),
      ev('m1','메모있음','apply','2026-11-01','','','A'),
      ev('L1','긴직무','apply','2026-11-05','','','A')
    ],
    axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900);
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(600);

// 1) 접힌 행 — 높이와 정보량
R['01_행수'] = (await p.$$('.appCard')).length;
R['02_행높이'] = await p.$eval('.acHit', e => Math.round(e.getBoundingClientRect().height));
R['03_한화면에보이는행'] = await p.evaluate(() => [...document.querySelectorAll('.acHit')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= 844 - 58; }).length);
R['04_타임라인은목록에없음'] = (await p.$$('#appCards .tl, #appCards .stp')).length === 0;
R['05_삭제버튼_목록에없음'] = (await p.$$('#appCards [data-delgroup], #appCards .arBtns')).length === 0;

// 2) 정렬 — 결과 밀린 건이 맨 위
R['06_정렬'] = await p.$$eval('.acCo', n => n.map(x => x.textContent.trim()).join(' > '));

// 3) 결과 입력이 목록에서 바로 가능한가 (주 액션)
const first = await p.$('.appCard');
R['07_첫행에결과입력'] = await first.evaluate(e => !!e.querySelector('.askRes [data-val="pass"]'));
R['08_결과문구'] = (await p.textContent('.appCard .askRes')).replace(/\s+/g,' ').trim();

// 4) 24시간 이내는 남은 시간으로
R['09_남은시간'] = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='오늘마감');
  const d = r.querySelector('.dd'); return d ? d.textContent.trim() + ' / ' + d.className : 'none'; });
R['10_먼날짜는Dday'] = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='먼날짜');
  return r.querySelector('.dd')?.textContent.trim() || 'none'; });

// 5) 상세 시트
await p.evaluate(() => [...document.querySelectorAll('.appCard')]
  .find(x => x.querySelector('.acCo')?.textContent.trim()==='결과밀림').querySelector('.acHit').click());
await p.waitForTimeout(600);
R['11_시트열림'] = await p.$eval('#apBg', e => e.classList.contains('open'));
R['12_시트제목'] = await p.textContent('#apTitle');
R['13_스테퍼단계수'] = (await p.$$('#apBody .stp li')).length;
R['14_스테퍼_통과표시'] = (await p.$$('#apBody .stp li.sPass')).length;
R['15_스테퍼_결과필요'] = (await p.$$('#apBody .stp li.sNeed')).length;
R['16_시트_결과입력은stepper안'] = (await p.$$('#apBody .stpAsk [data-val]')).length > 0;
R['16b_시트에중복입력없음'] = (await p.$$('#apBody .askRes')).length === 0;
R['16c_시트_진행률제거'] = (await p.$$('#apBody .apPct, #apBody .apBar')).length === 0;
R['16d_시트_회색카드제거'] = (await p.$$('#apBody .apNote')).length === 0;
R['16e_수정텍스트숨김'] = await p.evaluate(() => { const e = document.querySelector('.stpEdit');
  return !e || getComputedStyle(e).display === 'none'; });
R['17_주액션'] = (await p.textContent('#apAddStage')).trim();
R['18_보류버튼'] = (await p.textContent('#apHold')).trim();

// 6) 시트에서 보류 → 목록 반영
await p.click('#apHold'); await p.waitForTimeout(700);
R['19_보류후시트문구'] = (await p.textContent('#apHold')).trim();
await p.click('#apClose'); await p.waitForTimeout(500);
R['20_목록에보류반영'] = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='결과밀림');
  return r.querySelector('.acMeta').textContent.trim().startsWith('보류'); });

// 7) 목록에서 결과 입력 → 상태가 바뀐다
await p.evaluate(() => { const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='결과밀림');
  r.querySelector('.acHit').click(); });
await p.waitForTimeout(500); await p.click('#apHold'); await p.waitForTimeout(500); await p.click('#apClose'); await p.waitForTimeout(500);
await p.evaluate(() => { const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='결과밀림');
  r.querySelector('.askRes [data-val="pass"]').click(); });
await p.waitForTimeout(900);
if (await p.$eval('#modalBg', e => e.classList.contains('open'))) { await p.click('#cancelBtn'); await p.waitForTimeout(400); }
R['21_결과입력후상태'] = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.appCard')].find(x => x.querySelector('.acCo')?.textContent.trim()==='결과밀림');
  return r.querySelector('.acMeta').textContent.replace(/\s+/g,' ').trim(); });

// 8) 중복 상태 필터가 사라졌는가
R['22_상태select제거'] = (await p.$$('#statusFilter')).length === 0;
R['22b_필터한줄'] = (await p.$$('#s-apps .stickyTools .chipRow')).length === 1;
R['22c_필터영역높이'] = await p.$eval('.stickyTools', e => Math.round(e.getBoundingClientRect().height));
R['22d_첫행시작y'] = await p.$eval('.acHit', e => Math.round(e.getBoundingClientRect().top));
R['22e_직무2줄허용'] = await p.$eval('.acRole', e => getComputedStyle(e).webkitLineClamp);
R['23_퍼널칩유지'] = (await p.$$('.fchip, #pipeChips .chip2')).length > 0;

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

