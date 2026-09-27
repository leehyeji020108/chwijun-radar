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
await p.addInitScript(() => {
  if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s','1');
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[
      {id:'e1',company:'SK하이닉스',role:'경영지원',tier:'S',status:'',date:'2026-09-20',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:'https://talent.skhynix.com'},
      {id:'e2',company:'SK하이닉스',role:'경영지원',tier:'S',status:'',date:'2026-09-25',time:'',stage:'test',kind:'process',result:'',hold:false,progress:0,english:'',note:'',url:''},
      {id:'e3',company:'현대카드',role:'카드상품기획',tier:'S',status:'',date:'2026-09-22',time:'',stage:'apply',kind:'deadline',result:'',hold:false,progress:0,english:'',note:'',url:''},
      {id:'e4',company:'',role:'',tier:'S',status:'',date:'2026-09-09',time:'',stage:'cert',kind:'event',result:'',hold:false,progress:0,english:'',note:'',url:''}],
    axes:{}, inbox:[], dismissed:[], seedVersion:2, resultVersion:1, updatedAt:Date.now(),
    profile:{done:true,pdb:false,name:'테스터',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:['APR'],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'BASE',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);

// 1) 감시 흔적이 하나도 없어야 한다
R['01_감시메뉴없음'] = (await p.$$('[data-go="watch"]')).length === 0;
R['02_감시화면없음'] = (await p.$$('#s-watch')).length === 0;
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(300);
const moreTxt = await p.textContent('#s-more');
R['03_더보기에감시없음'] = !moreTxt.includes('감시');
R['04_상태에watch없음'] = await p.evaluate(() => !('watch' in JSON.parse(localStorage.getItem('jobRadarStateV3'))));

// 2) 프롬프트는 지원 목록에서 자동으로 만들어진다
const prompt = await p.evaluate(() => window.__dbg.myPrompt());
R['05_기본프롬프트'] = prompt.startsWith('BASE');
R['06_감시단어없음'] = !prompt.includes('감시');
R['07_지원회사자동'] = prompt.includes('SK하이닉스') && prompt.includes('현대카드');
R['08_회사수'] = await p.evaluate(() => window.__dbg.myCompanies().length);
R['09_URL따라옴'] = prompt.includes('https://talent.skhynix.com');
R['10_checks요구'] = prompt.includes('"checks"') && prompt.includes('2건 전부');

// 3) 확인 안 온 회사만 한 줄로
await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify({
  items:[{company:'한화생명',role:'서비스기획',tier:'S',url:'https://company.hanwhalife.com',
          schedule:[{stage:'apply',date:'2026-09-18',time:'15:00'}]},
         {company:'무신사',role:'브랜드마케팅',tier:'A',note:'[미검증] 커뮤니티에서만 봄',url:'',
          schedule:[{stage:'apply',date:'2026-09-25',time:''}]}],
  checks:[{company:'SK하이닉스',url:'https://talent.skhynix.com',checkedAt:'2026-09-09',status:'none',note:'신규 없음'}]}));
await p.click('#impRun'); await p.waitForTimeout(1000);
const imp = await p.textContent('#impResult');
R['11_안온회사표시'] = imp.includes('현대카드') && imp.includes('확인 결과가 안 온');
R['12_확인된건안뜸'] = !imp.includes('SK하이닉스');
R['13_미검증경고'] = imp.includes('미검증');
await p.waitForTimeout(1800);

// 4) 검토함
await p.click('.tab[data-tab="inbox"]'); await p.waitForTimeout(500);
R['14_검토함2건'] = (await p.$$('.inCard')).length;
R['15_미검증배지'] = (await p.$$('.unv')).length === 1;

// 5) 전부 확인되면 조용해야 한다
await p.click('.tab[data-tab="more"]'); await p.evaluate(() => window.__dbg.openSheet('impBg')); await p.waitForTimeout(400);
await p.fill('#impBox', JSON.stringify({ items:[],
  checks:[{company:'SK하이닉스',status:'none'},{company:'현대카드',status:'none'}]}));
await p.click('#impRun'); await p.waitForTimeout(900);
const imp2 = await p.textContent('#impResult');
R['16_전부확인시조용'] = !imp2.includes('확인 결과가 안 온');

// 6) 구버전 배열 호환 + 기존 화면
await p.fill('#impBox', JSON.stringify([{company:'배달의민족',role:'브랜드마케팅',tier:'S',url:'https://career.woowahan.com/x',
  schedule:[{stage:'apply',date:'2026-10-05',time:''}]}]));
await p.click('#impRun'); await p.waitForTimeout(900);
R['17_배열호환'] = await p.evaluate(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).inbox.length);
await p.click('.tab[data-tab="home"]'); await p.waitForTimeout(400);
R['18_홈렌더'] = (await p.textContent('#nextAction')).length > 5;
await p.click('.tab[data-tab="apps"]'); await p.waitForTimeout(400);
R['19_지원목록'] = (await p.$$('.appRow')).length;
await p.click('.tab[data-tab="cal"]'); await p.waitForTimeout(400);
R['20_캘린더칩'] = (await p.$$('.pill')).length > 0;

// 7) 완전 초기화
await p.click('.tab[data-tab="more"]'); await p.waitForTimeout(250);
R['21_초기화문구'] = (await p.textContent('#handoffBtn')).includes('감시') === false;
await p.evaluate(() => {{ const d = document.getElementById('dangerZone'); if (d) d.open = true; }});
await p.click('#handoffBtn'); await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(2500);
R['22_초기화후온보딩'] = await p.$eval('#onboard', e => !e.hidden);

console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();

