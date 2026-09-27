import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_NODE_MODULES
  ? `${process.env.CODEX_NODE_MODULES}/playwright`
  : 'playwright');

const MOCK = 'http://127.0.0.1:8877';
const PROD = 'https://qxejfgbrszcnejkrgiwu.supabase.co';
const CHROME = process.env.PLAYWRIGHT_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath:CHROME });
const results = {};
const failures = [];
let productionHits = 0;
const syncDiagnostics = [];

const baseState = (withEvent = false) => ({
  events: withEvent ? [{ id:'e1', company:'신규회사', role:'전략기획', tier:'S', status:'',
    date:'2026-10-01', time:'', stage:'apply', kind:'deadline', result:'', hold:false,
    progress:0, english:'', note:'메모', url:'' }] : [],
  axes:{}, inbox:[], dismissed:[], archived:{}, qualifications:[], outProposals:[], ignoredOut:{},
  seedVersion:2, resultVersion:1, updatedAt:Date.now(),
  profile:{ done:true, pdb:false, name:'신규사용자', grad:'', major:'', jobs:['전략기획'],
    axisOrder:[], criteria:{}, excludeCompanies:[], excludeRoles:[], strength:'', want:'', avoid:'',
    prompt:'', createdAt:Date.now() }
});

async function fresh({ state, room, dirty = false, failFirstPut = false,
  failGetStatus = 0, badRemotePayload = false, breakKeyDerivation = false } = {}) {
  const diagnosticStart = syncDiagnostics.length;
  const context = await browser.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
  await context.route(`${PROD}/**`, route => {
    productionHits++;
    failures.push(`production request attempted: ${route.request().url()}`);
    return route.abort('blockedbyclient');
  });
  await context.route('**/app.js*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(/const DEFAULT_SYNC_URL = '[^']*'/, `const DEFAULT_SYNC_URL = '${MOCK}'`);
    await route.fulfill({ response, body, headers:{...response.headers(), 'content-type':'application/javascript'} });
  });
  let shouldFailPut = failFirstPut;
  if (failFirstPut) {
    await context.route(`${MOCK}/rest/v1/rpc/radar_put`, async route => {
      if (shouldFailPut) {
        shouldFailPut = false;
        await route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({message:'first insert unavailable'}) });
      } else await route.continue();
    });
  }
  if (failGetStatus || badRemotePayload) {
    await context.route(`${MOCK}/rest/v1/rpc/radar_get`, async route => {
      if (failGetStatus) {
        await route.fulfill({ status:failGetStatus, contentType:'application/json', body:JSON.stringify({message:'rpc unavailable'}) });
      } else if (badRemotePayload) {
        await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([
          {payload:'not-encrypted',revision:1,updated_at:new Date().toISOString()}]) });
      } else await route.continue();
    });
  }
  if (breakKeyDerivation) {
    await context.addInitScript(() => {
      Object.defineProperty(SubtleCrypto.prototype, 'deriveKey', {
        configurable:true, value:() => Promise.reject(new Error('derive blocked for QA')) });
    });
  }
  const page = await context.newPage();
  page.on('console', m => {
    const t=m.text(); if(t.startsWith('[radar-sync]')) {
      const [,code,phase,status]=t.split(/\s+/); syncDiagnostics.push({code,phase,status:status?Number(status):null});
    }
  });
  await page.addInitScript(({state, room, dirty}) => {
    if (localStorage.getItem('__firstsync_seeded')) return;
    localStorage.clear();
    if (state) localStorage.setItem('jobRadarStateV3', JSON.stringify(state));
    if (room) localStorage.setItem('jobRadarSyncCfg', JSON.stringify({room,baseRev:0,dirty,deviceId:'fresh'}));
    localStorage.setItem('__firstsync_seeded', '1');
  }, {state,room,dirty});
  await page.goto('http://127.0.0.1:8899/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(900);
  return { context, page, diagnosticStart };
}
const latestDiagnostic = (start, code) => syncDiagnostics.slice(start).reverse().find(x=>x.code===code)||null;

async function connect(page, room) {
  await page.click('.tab[data-tab="more"]');
  await page.click('#syncBtn');
  await page.fill('#sRoom', room);
  await page.click('#syncSave');
  await page.waitForTimeout(1800);
}

async function dump() {
  return await (await fetch(`${MOCK}/__dump`)).json();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 1) 완전히 신규 사용자: 온보딩은 로컬 전용으로 완료하고,
// 필요할 때 더보기에서 동기화를 켜면 신규 room 최초 push.
{
  const {context,page} = await fresh();
  await page.click('#obNext'); // welcome -> basic
  await page.fill('#i_name','온보딩신규');
  for (let i=0; i<6; i++) { await page.click('#obNext'); await page.waitForTimeout(80); }
  const beforeFinish = await page.evaluate(() => ({
    done:document.querySelector('.obTitle')?.textContent.includes('준비 끝났습니다'),
    cfg:localStorage.getItem('jobRadarSyncCfg')
  }));
  await page.click('#obNext'); // done -> app, 로컬에만 프로필 저장
  const localOnly = await page.evaluate(() => ({
    cfg:localStorage.getItem('jobRadarSyncCfg'), bannerHidden:document.getElementById('syncBar').hidden
  }));
  const room = 'jr-onboarding-first-000000000000';
  await connect(page, room); // 사용자가 필요할 때 명시적으로 연결
  await page.waitForTimeout(2000);
  const rows = await dump();
  results.onboardingFirstPush = {
    localOnlyBeforeConnect:beforeFinish.done && !beforeFinish.cfg && !localOnly.cfg && localOnly.bannerHidden,
    roomCreated:rows.length===1, syncText:await page.textContent('#syncText')
  };
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 2) 프로필만 있고 일정 0건인 사용자가 나중에 최초 동기화를 켜는 경로.
{
  const room = 'jr-profile-only-000000000000000';
  const {context,page} = await fresh({state:baseState(false)});
  await connect(page, room);
  const rows = await dump();
  results.profileOnlyFirstPush = { roomCreated:rows.length===1, syncText:await page.textContent('#syncText') };
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 3~5) 일정이 있는 신규 room -> 최초 push -> reload -> 새 페이지 재접속 pull.
{
  const room = 'jr-first-push-000000000000000000';
  const {context,page} = await fresh({state:baseState(true)});
  await connect(page, room);
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('jobRadarSyncCfg')));
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  const reload = await page.evaluate(() => JSON.parse(localStorage.getItem('jobRadarSyncCfg')));
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'}); await reopened.waitForTimeout(1200);
  results.firstPushReloadReconnect = {
    firstRev:first.baseRev, firstDirty:first.dirty, reloadRev:reload.baseRev,
    reconnectText:await reopened.textContent('#syncText')
  };
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 6) offline -> online 복귀 후 dirty 데이터가 올라가고 오류 배너가 사라지는가.
{
  const room = 'jr-offline-online-000000000000000';
  const {context,page} = await fresh({state:baseState(true)});
  await context.setOffline(true);
  await connect(page, room);
  const failed = await page.textContent('#syncText');
  const issue = await page.evaluate(() => window.__dbg.syncIssue());
  await context.setOffline(false);
  await page.waitForTimeout(2500);
  results.offlineOnline = { failed, issue, recovered:await page.textContent('#syncText'),
    bannerHidden:await page.$eval('#syncBar',e=>e.hidden), issueAfter:await page.evaluate(() => window.__dbg.syncIssue()) };
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 7) 최초 room create RPC 실패 -> 배너 클릭 retry -> 성공 즉시 제거.
{
  const room = 'jr-retry-first-create-000000000000';
  const {context,page} = await fresh({state:baseState(true),failFirstPut:true});
  await connect(page, room);
  const failed = await page.textContent('#syncText');
  const issue = await page.evaluate(() => window.__dbg.syncIssue());
  const beforeHidden = await page.$eval('#syncBar',e=>e.hidden);
  await page.evaluate(() => document.getElementById('syncBar').click()); await page.waitForTimeout(1800);
  results.retryFirstCreate = { failed, issue, beforeHidden, after:await page.textContent('#syncText'),
    afterHidden:await page.$eval('#syncBar',e=>e.hidden), issueAfter:await page.evaluate(() => window.__dbg.syncIssue()) };
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 8) pull RPC 자체 실패는 rpc로 구분한다.
{
  const room = 'jr-rpc-fail-00000000000000000000';
  const {context,page,diagnosticStart} = await fresh({state:baseState(true),room,dirty:true,failGetStatus:503});
  const issue = await page.evaluate(() => window.__dbg.syncIssue()) || latestDiagnostic(diagnosticStart,'rpc');
  results.rpcFailure = issue;
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 9) 원격 payload 복호화 실패는 crypto-decrypt로 구분한다.
{
  const room = 'jr-decrypt-fail-00000000000000000';
  const {context,page,diagnosticStart} = await fresh({state:baseState(false),room,badRemotePayload:true});
  const issue = await page.evaluate(() => window.__dbg.syncIssue()) || latestDiagnostic(diagnosticStart,'crypto-decrypt');
  results.decryptFailure = issue;
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 10) 키 파생 실패는 secret/key derivation 단계로 구분한다.
{
  const room = 'jr-key-fail-000000000000000000000';
  const {context,page} = await fresh({state:baseState(true),room,dirty:true,breakKeyDerivation:true});
  const issue = await page.evaluate(() => window.__dbg.syncIssue());
  results.keyDerivationFailure = issue;
  await context.close();
}

await fetch(`${MOCK}/__mode?legacy=0`);

// 11) 로컬 baseRev가 원격보다 앞서는 비정상 상태는 CAS/revision으로 구분한다.
{
  const room = 'jr-cas-revision-00000000000000000';
  const {context,page} = await fresh({state:baseState(true)});
  await connect(page, room);
  await page.evaluate(() => {
    const cfg = window.__dbg.cfg(); cfg.baseRev = 999; cfg.dirty = false;
    localStorage.setItem('jobRadarSyncCfg', JSON.stringify(cfg));
  });
  await page.evaluate(() => window.__dbg.pull({silent:false}));
  await page.waitForTimeout(500);
  results.casRevisionFailure = await page.evaluate(() => window.__dbg.syncIssue());
  await context.close();
}

results.productionGuard = { productionHits };
console.log(JSON.stringify(results,null,2));
if (!results.onboardingFirstPush.roomCreated) failures.push('onboarding first push did not create room');
if (!results.onboardingFirstPush.localOnlyBeforeConnect) failures.push('new onboarding did not stay local-only before opt-in');
if (!results.profileOnlyFirstPush.roomCreated) failures.push('profile-only first push did not create room');
if (results.firstPushReloadReconnect.firstRev < 1 || results.firstPushReloadReconnect.reloadRev < 1)
  failures.push('first push/reload revision was not persisted');
if (!results.firstPushReloadReconnect.reconnectText.includes('동기화됨')) failures.push('reconnect pull did not settle');
if (results.offlineOnline.issue?.code !== 'network' || !results.offlineOnline.bannerHidden || results.offlineOnline.issueAfter)
  failures.push('offline/online recovery or diagnostics failed');
if (results.retryFirstCreate.issue?.code !== 'room-create' || results.retryFirstCreate.beforeHidden
  || !results.retryFirstCreate.afterHidden || results.retryFirstCreate.issueAfter)
  failures.push('first room retry or diagnostics failed');
if (results.rpcFailure?.code !== 'rpc') failures.push('RPC diagnostics classification failed');
if (results.decryptFailure?.code !== 'crypto-decrypt') failures.push('decrypt diagnostics classification failed');
if (results.keyDerivationFailure?.code !== 'key-derivation') failures.push('key derivation diagnostics classification failed');
if (results.casRevisionFailure?.code !== 'cas-revision') failures.push('CAS/revision diagnostics classification failed');
if (failures.length) throw new Error(failures.join('\n'));
await browser.close();
