import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(path.join(root, 'release-lock.json'), 'utf8'));
const read = file => readFileSync(path.join(root, file));
const text = file => read(file).toString('utf8');
const digest = file => createHash('sha256').update(read(file)).digest('hex');

for (const [file, expected] of Object.entries(lock.sha256 || {})) {
  assert.equal(
    digest(file),
    expected,
    `${file}가 승인된 ${lock.baseline} 기준선과 다릅니다. 배포를 중단합니다.`
  );
}

const html = text('index.html');
const app = text('app.js');
const sw = text('sw.js');
const version = String(lock.version || '');

assert.ok(version, 'release-lock.json version is required');
assert.match(html, new RegExp(`styles\\.css\\?v=${version.replaceAll('.', '\\.')}["']`));
assert.match(html, new RegExp(`data\\.js\\?v=${version.replaceAll('.', '\\.')}["']`));
assert.match(html, new RegExp(`app\\.js\\?v=${version.replaceAll('.', '\\.')}["']`));
assert.match(sw, new RegExp(`radar-v${version.replaceAll('.', '\\.')}`));

for (const id of ['s-home', 'nextAction', 'funnel', 'upcoming', 'inboxAlert']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `정상 홈 기준 요소 #${id}가 없습니다.`);
}

assert.match(app, /const retiredPlanIds = new Set\(\[/, '폐기 계획 정리 로직이 없습니다.');
assert.match(app, /delete st\.planVersion;/, '폐기 계획 버전 정리 로직이 없습니다.');
for (const forbidden of [
  /function\s+mergePlan\s*\(/,
  /const\s+PERSONAL_PLAN\b/,
  /const\s+PLAN_EVENTS\b/,
  /st\.planVersion\s*=/
]) {
  assert.doesNotMatch(app, forbidden, `폐기된 개인 실행계획 주입 코드가 감지됐습니다: ${forbidden}`);
}

console.log(JSON.stringify({
  releaseGate: 'passed',
  version,
  baseline: lock.baseline,
  lockedFiles: Object.keys(lock.sha256).length
}, null, 2));
