import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [], R = {};
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PE: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_CONNECTION_RESET')) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);

// 1) 신규 = 온보딩이 뜬다
R['01_온보딩표시'] = await p.$eval('#onboard', e => !e.hidden);
R['02_환영문구'] = (await p.textContent('.obTitle')).replace(/\s+/g,' ').trim();
await p.click('#obNext'); await p.waitForTimeout(300);

// 2) 기본 정보
R['03_기본'] = (await p.textContent('.obTitle')).trim();
await p.fill('#i_name','친구A'); await p.fill('#i_grad','2026.02'); await p.fill('#i_major','경영학');
await p.click('#obNext'); await p.waitForTimeout(300);

// 3) 직무
R['04_직무칩'] = (await p.$$('[data-job]')).length;
await p.click('[data-job="마케팅"]'); await p.click('[data-job="HR"]');
await p.fill('#i_jobetc','브랜드전략');
await p.click('#obNext'); await p.waitForTimeout(300);

// 4) 가치축 순위
R['05_가치축'] = (await p.$$('[data-rank]')).length;
await p.click('[data-rank="pay"]'); await p.waitForTimeout(200);
await p.click('[data-rank="wlbX"]').catch(()=>{});
await p.click('[data-rank="brand"]'); await p.waitForTimeout(200);
await p.click('[data-rank="people"]'); await p.waitForTimeout(250);
R['06_순위표시'] = await p.$$eval('.rankItem.on .rkNo', n => n.map(x=>x.textContent).join(','));
await p.click('#obNext'); await p.waitForTimeout(300);

// 5) 기업 조건
R['07_조건항목'] = (await p.$$('.critRow')).length;
await p.click('[data-crit="salary"][data-v="5"]'); await p.waitForTimeout(250);
await p.click('[data-crit="wlb"][data-v="5"]'); await p.waitForTimeout(250);
await p.click('[data-crit="fame"][data-v="1"]'); await p.waitForTimeout(250);
await p.click('#obNext'); await p.waitForTimeout(300);

// 6) 제외
await p.fill('#i_exc','쿠팡'); await p.click('#addExc'); await p.waitForTimeout(300);
await p.fill('#i_exr','지방순환'); await p.click('#addExr'); await p.waitForTimeout(300);
R['08_제외태그'] = (await p.$$('.tag')).length;
await p.click('#obNext'); await p.waitForTimeout(300);

// 7) 서술형
await p.fill('#i_strength','마케팅 인턴 6개월, 학회 회장');
await p.fill('#i_want','브랜드 마케터로 성장');
await p.fill('#i_avoid','영업, 지방근무');
await p.click('#obNext'); await p.waitForTimeout(400);

// 8) 신규 Radar는 로컬 전용으로 끝난다. 동기화는 더보기에서 선택한다.
R['09_로컬전용'] = await p.evaluate(() =>
  !document.getElementById('obKeyVal') && !localStorage.getItem('jobRadarSyncCfg'));

// 9) 완료
R['10_완료제목'] = (await p.textContent('.obTitle')).replace(/\s+/g,' ').trim();
await p.click('#obNext'); await p.waitForTimeout(700);
const prompt = await p.evaluate(() => window.__dbg.myPrompt());
R['11_프롬프트길이'] = prompt.length;
R['12_프롬프트에내이름'] = prompt.includes('친구A');
R['13_프롬프트에내직무'] = prompt.includes('마케팅') && prompt.includes('브랜드전략');
R['14_프롬프트에제외'] = prompt.includes('쿠팡') && prompt.includes('지방순환');
R['15_준기기준없음'] = !prompt.includes('APR') && !prompt.includes('롯데백화점') && !prompt.includes('준기') && !prompt.includes('전통주');
R['16_가치축순서'] = prompt.includes('1. 연봉·보상');

// 10) 앱 진입 상태
R['17_온보딩닫힘'] = await p.$eval('#onboard', e => e.hidden);
R['18_일정수'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);
R['19_퍼스널DB숨김'] = await (async()=>{ await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
  return await p.$eval('[data-go="db"]', e => e.hidden); })();
R['20_프로필저장'] = await p.evaluate(() => { const pf=JSON.parse(localStorage.getItem('jobRadarStateV3')).profile;
  return pf.done + '/' + pf.name + '/' + pf.jobs.join(',') + '/' + pf.axisOrder.join(','); });

// 11) 개인화된 제외 규칙이 실제로 막는가
await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify([
  {company:'쿠팡',role:'브랜드마케팅',tier:'S',schedule:[{stage:'apply',date:'2026-10-01',time:''}]},
  {company:'무신사',role:'지방순환 영업',tier:'A',schedule:[{stage:'apply',date:'2026-10-02',time:''}]},
  {company:'배달의민족',role:'브랜드마케팅',tier:'S',jd:'브랜드 캠페인',schedule:[{stage:'apply',date:'2026-10-03',time:''}]}]));
await p.click('#impRun'); await p.waitForTimeout(900);
R['21_검토함'] = (await p.$$('.inCard')).length;
R['22_쿠팡차단'] = !(await p.textContent('#inboxList')).includes('쿠팡');
R['23_지방순환차단'] = !(await p.textContent('#inboxList')).includes('무신사');
R['24_정상통과'] = (await p.textContent('#inboxList')).includes('배달의민족');

// 12) 재시작해도 온보딩 안 뜸
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(900);
R['25_재시작온보딩'] = await p.$eval('#onboard', e => e.hidden);

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

