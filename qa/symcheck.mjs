// 큰 함수를 범위로 교체할 때 이웃 함수까지 날아가는 걸 막는 절차용 검사.
// node --check 로는 절대 안 잡힌다 (문법은 멀쩡하니까).
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_NODE_MODULES?process.env.CODEX_NODE_MODULES+'/playwright':'playwright');
const b = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errs = [];
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PE: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/ERR_CONNECTION_RESET|jsdelivr|404/.test(m.text())) errs.push('C: '+m.text()); });
p.on('dialog', async d => await d.accept());
await p.route('**cdn.jsdelivr.net**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
await p.addInitScript(() => {
  localStorage.setItem('jobRadarStateV3', JSON.stringify({
    events:[], axes:{}, dismissed:[], archived:{}, seedVersion:0, resultVersion:1, updatedAt:Date.now(),
    // 첫 렌더에서 어학 배지·종료 제안까지 그려지게 한다 (v8.1 TDZ 버그가 여기서 났다)
    inbox:[{ id:'i1', company:'POSCO DX', role:'전략기획', tier:'S', jd:'x', require:'x',
      english:'OPIc IH 이상', note:'n', url:'https://recruit.posco.com/', unverified:false,
      schedule:[{stage:'apply',date:'2026-09-30',time:''}] }],
    qualifications:[{ id:'q1', type:'TOEIC Speaking', score:null, grade:null,
      testDate:'2026-09-09', resultDate:'2026-09-12', validUntil:'' }],
    outProposals:[{ key:'현대카드|카드상품기획', company:'현대카드', role:'카드상품기획',
      reason:'제외', at:Date.now() }],
    profile:{done:true,pdb:true,name:'t',grad:'',major:'',jobs:[],axisOrder:[],criteria:{},
      excludeCompanies:[],excludeRoles:[],strength:'',want:'',avoid:'',prompt:'P',createdAt:1}}));
});
await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900);
// seedVersion 0 is migrated automatically; do not depend on the optional
// "처음 사용 도움" block, which is intentionally hidden once events exist.
await p.waitForFunction(() => JSON.parse(localStorage.getItem('jobRadarStateV3')).events.length > 0);
const screens = ['home','cal','apps','inbox','more'];
const out = {};
for (const t of screens) { await p.click(`.tab[data-tab="${t}"]`); await p.waitForTimeout(450);
  out[t] = await p.$eval(`#s-${t}`, e => e.innerHTML.trim().length); }
await p.click('.tab[data-tab="more"]'); await p.click('[data-go="radar"]'); await p.waitForTimeout(450);
out.radar = await p.$eval('#s-radar', e => e.innerHTML.trim().length);
await p.click('#backBtn'); await p.click('[data-go="db"]'); await p.waitForTimeout(500);
out.db = await p.$eval('#s-db', e => e.innerHTML.trim().length);
// 시트도 한 번씩 연다
await p.click('#backBtn'); await p.waitForTimeout(300);
await p.click('.tab[data-tab="cal"]'); await p.waitForTimeout(400);
await p.click('.day[data-day]:not(.empty)').catch(()=>{});
await p.waitForTimeout(500);
out.calList = await p.$eval('#calList', e => e.innerHTML.trim().length);
console.log('화면별 렌더 길이:', JSON.stringify(out));
const empty = Object.entries(out).filter(([k,v]) => v < 40).map(([k])=>k);
console.log(empty.length ? '⚠ 비어 있는 화면: ' + empty.join(', ') : '✅ 모든 화면 렌더됨');
console.log('ERRORS', errs.length ? errs : 'none');
await b.close();
process.exit(errs.length || empty.length ? 1 : 0);

