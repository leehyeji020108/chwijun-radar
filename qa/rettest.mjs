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
await p.waitForTimeout(700);

// A) 완전 신규 = obReturn 없음
R['01_신규_온보딩'] = await p.$eval('#onboard', e => !e.hidden);
R['02_신규_복귀블록없음'] = (await p.$$('.obReturn')).length === 0;

// B) 기존 사용자 상태 주입 (일정 2건, 프로필 없음)
await p.evaluate(() => {
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events: [
      {id:'x1',company:'SK하이닉스',role:'경영지원',tier:'S',status:'지원완료',date:'2026-08-26',time:'',stage:'apply',kind:'apply',result:'pass',hold:false,progress:0,english:'',note:'',url:''},
      {id:'x2',company:'SK하이닉스',role:'경영지원',tier:'S',status:'검사·면접',date:'2026-09-12',time:'10:00',stage:'test',kind:'test',result:'',hold:false,progress:0,english:'',note:'',url:''}
    ],
    axes:{'현대카드':{pay:4}}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now()
  }));
});
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(800);
R['03_기존_온보딩뜸'] = await p.$eval('#onboard', e => !e.hidden);
R['04_복귀블록보임'] = (await p.$$('.obReturn')).length === 1;
R['05_그대로쓰기버튼'] = (await p.textContent('#obKeep')).trim();

// C) 설문 경로로 들어가면 기존 제외기준이 프리필되는가
await p.click('#obNext'); await p.waitForTimeout(300);   // basic
await p.click('#obNext'); await p.waitForTimeout(250);   // jobs
await p.click('#obNext'); await p.waitForTimeout(250);   // rank
await p.click('#obNext'); await p.waitForTimeout(250);   // criteria
await p.click('#obNext'); await p.waitForTimeout(350);   // exclude
R['06_제외프리필'] = await p.$$eval('.tag', n => n.map(x=>x.textContent.replace(/[×✕]/g,'').trim()).join(','));

// D) 처음으로 돌아가 '그대로 쓰기'
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('#obKeep'); await p.waitForTimeout(700);
R['07_온보딩닫힘'] = await p.$eval('#onboard', e => e.hidden);
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')));
R['08_일정보존'] = st.events.length;
R['09_평가축보존'] = JSON.stringify(st.axes);
R['10_프로필완료'] = st.profile.done;
R['11_제외기업'] = st.profile.excludeCompanies.join(',');
R['12_제외직무'] = st.profile.excludeRoles.join(',');
R['13_퍼스널DB켬'] = st.profile.pdb === true;
R['14_프롬프트있음'] = (st.profile.prompt||'').length > 200;

// E) 화면 상태
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
R['15_지원목록'] = (await p.textContent('#appCards')).includes('SK하이닉스');
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
R['16_퍼스널DB노출'] = await p.$eval('[data-go="db"]', e => !e.hidden);

// F) 예전 제외 규칙이 실제로 작동
await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify([
  {company:'APR',role:'전략기획',tier:'S+',schedule:[{stage:'apply',date:'2026-10-01',time:''}]},
  {company:'현대오토에버',role:'국내영업',tier:'A',schedule:[{stage:'apply',date:'2026-10-02',time:''}]},
  {company:'한화생명',role:'서비스기획',tier:'S',schedule:[{stage:'apply',date:'2026-09-18',time:'15:00'}]}]));
await p.click('#impRun'); await p.waitForTimeout(900);
const ibx = await p.textContent('#inboxList');
R['17_APR차단'] = !ibx.includes('APR');
R['18_국내영업차단'] = !ibx.includes('현대오토에버');
R['19_한화통과'] = ibx.includes('한화생명');

// G) 재시작해도 온보딩 안 뜸
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(900);
R['20_재시작온보딩'] = await p.$eval('#onboard', e => e.hidden);
R['21_일정유지'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length);

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

