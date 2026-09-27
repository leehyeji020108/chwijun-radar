/**
 * Fail-closed QA runner.
 *
 * Usage:
 *   node qa/guarded-runner.mjs qa/<test>.mjs
 *
 * Browser and Node requests are restricted to the local fixture servers.
 * Any attempt to call the production Supabase/Vercel endpoints makes the
 * process fail, even when the test itself would otherwise pass.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const modulesRoot = process.env.CODEX_NODE_MODULES
  || 'C:/Users/quswn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const chromePath = process.env.PLAYWRIGHT_CHROMIUM
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.env.CODEX_NODE_MODULES = modulesRoot;
process.env.PLAYWRIGHT_CHROMIUM = chromePath;
const { chromium } = require(`${modulesRoot}/playwright`);

const target = process.argv[2];
if (!target) throw new Error('QA test path is required');

const localPorts = new Set(['8877', '8878', '8899']);
const allowed = value => {
  const url = new URL(String(value));
  return url.protocol === 'http:'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && localPorts.has(url.port);
};
const blocked = [];

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const value = input?.url || input;
  if (!allowed(value)) {
    blocked.push(`node:${value}`);
    throw new Error(`QA external Node request denied: ${value}`);
  }
  return nativeFetch(input, init);
};

const nativeLaunch = chromium.launch.bind(chromium);
chromium.launch = async options => {
  const browser = await nativeLaunch({ ...options, executablePath: chromePath });
  const nativeNewContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await nativeNewContext({ ...options, serviceWorkers: 'block' });
    const nativeRoute = context.route.bind(context);
    const gate = handler => async route => {
      const requestUrl = new URL(route.request().url());
      // The app's icon stylesheet is irrelevant to functional QA. Stub it so
      // production API traffic remains the only possible external dependency.
      if (requestUrl.hostname === 'cdn.jsdelivr.net') {
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      if (!allowed(requestUrl)) {
        blocked.push(`browser:${requestUrl}`);
        return route.abort('blockedbyclient');
      }
      return handler(route);
    };
    await nativeRoute('**/*', gate(route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.port === '8878') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      return route.continue();
    }));
    context.route = (pattern, handler, options) => nativeRoute(pattern, gate(handler), options);
    return context;
  };
  return browser;
};

process.on('exit', () => {
  console.log(JSON.stringify({ qaExternalAttempts: blocked.length, blocked }));
  if (blocked.length) process.exitCode = 1;
});

await import(pathToFileURL(path.resolve(target)));
