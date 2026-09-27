import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const start = source.indexOf('const KIND_TO_STAGE');
const end = source.indexOf('function qualStatus');
const context = vm.createContext({ structuredClone });
vm.runInContext(data + '\n' + source.slice(start, end), context);
assert.equal(vm.runInContext('SEED_EVENTS.length', context), 0);
for (const seedVersion of [0, 2]) {
  context.input = { events:[], profile:{}, seedVersion, resultVersion:1 };
  assert.equal(vm.runInContext('migrate(input).events.length', context), 0);
}
context.input = {
  events: [{id:'kia', company:'사용자 회사', role:'직접 입력', stage:'apply', result:'submitted', hold:false, url:'', note:'보존할 메모'}],
  profile:{}, seedVersion:0, resultVersion:1
};
const result = vm.runInContext('migrate(input)', context);
assert.equal(result.events.length, 1);
assert.equal(result.events[0].note, '보존할 메모');
assert.equal(result.events[0].result, 'submitted');
console.log('No sample injection; existing user application preserved: PASS');
