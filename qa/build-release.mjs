import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qaDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qaDir, '..');
const out = path.join(root, '.vercel-static');

// Any mismatch throws before deployment files are created.
await import('./release-gate.mjs');

rmSync(out, { recursive:true, force:true });
mkdirSync(out, { recursive:true });

for (const file of ['index.html', 'styles.css', 'data.js', 'app.js', 'sw.js', 'manifest.webmanifest']) {
  cpSync(path.join(root, file), path.join(out, file));
}
cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive:true });

const lock = JSON.parse(readFileSync(path.join(root, 'release-lock.json'), 'utf8'));
console.log(JSON.stringify({ releaseBuild:'ready', version:lock.version, output:path.basename(out) }, null, 2));
