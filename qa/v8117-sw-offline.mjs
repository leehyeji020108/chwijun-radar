import {createRequire}from'node:module';
import assert from'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require((process.env.CODEX_NODE_MODULES||'C:/Users/quswn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')+'/playwright');
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),c=await b.newContext({serviceWorkers:'allow'});let external=0;
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({status:200,contentType:'text/css',body:''});if(u.hostname!=='127.0.0.1'||u.port!=='8899'){external++;return r.abort('blockedbyclient');}return r.continue();});
const p=await c.newPage();p.setDefaultTimeout(12000);
try{
 await p.goto('http://127.0.0.1:8899/',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await c.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
 const result=await p.evaluate(()=>({title:document.querySelector('h1')?.textContent,body:document.body.innerText.length,version:[...document.querySelectorAll('.footNote')].map(x=>x.textContent).join(' '),controller:!!navigator.serviceWorker.controller}));
 assert.equal(result.title,'취준 Radar');assert.ok(result.body>100);assert.match(result.version,/8\.1\.22/);assert.equal(result.controller,true);assert.equal(external,0);
 console.log(JSON.stringify({...result,offlineShell:true,externalRequests:external},null,2));
}finally{await c.setOffline(false);await b.close();}
