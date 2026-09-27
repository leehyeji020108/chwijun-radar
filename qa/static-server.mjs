import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = new Map([
  ['.html','text/html; charset=utf-8'], ['.js','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'], ['.json','application/json; charset=utf-8'],
  ['.webmanifest','application/manifest+json; charset=utf-8'], ['.png','image/png']
]);

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type':types.get(path.extname(file)) || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(8899, '127.0.0.1', () => console.log('static server on 8899'));
