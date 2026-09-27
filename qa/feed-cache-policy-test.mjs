import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(source,/const feedFetchOptions=\{headers,cache:'no-store'\}/);
assert.match(source,/radar_feed_items[^\n]+feedFetchOptions/);
assert.match(source,/radar_feed_status[^\n]+feedFetchOptions/);
console.log('feed cache policy: PASS');
