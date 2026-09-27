// Supabase RPC 흉내 — radar_get / radar_put (CAS). 테스트 전용.
import http from 'node:http';
const rows = new Map();               // id -> { payload, revision, updated_at }
let legacy = false;                   // true 면 구버전 서버(2-arg, revision 없음) 흉내
let delayMs = 0;                      // radar_put 응답을 일부러 지연 (in-flight 테스트용)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const body = req => new Promise(r => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); });
const send = (res, code, obj) => {
  res.writeHead(code, { 'content-type':'application/json',
    'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'*' });
  res.end(JSON.stringify(obj));
};
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 200, {});
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__delay') { delayMs = +(u.searchParams.get('ms')||0); return send(res,200,{delayMs}); }
  if (u.pathname === '/__mode') { legacy = u.searchParams.get('legacy') === '1'; rows.clear(); return send(res,200,{legacy}); }
  if (u.pathname === '/__dump') return send(res, 200, [...rows.entries()]);
  const p = JSON.parse((await body(req)) || '{}');

  if (u.pathname === '/rest/v1/rpc/radar_get') {
    const r = rows.get(p.p_id);
    if (!r) return send(res, 200, []);
    return send(res, 200, [ legacy ? { payload:r.payload } : { payload:r.payload, revision:r.revision, updated_at:r.updated_at } ]);
  }
  if (u.pathname === '/rest/v1/rpc/radar_put') {
    if (delayMs) await sleep(delayMs);
    if (!/^[0-9a-f]{64}$/.test(p.p_id || '')) return send(res, 400, { message:'invalid sync id' });
    if (legacy) {
      if ('p_expected_revision' in p)
        return send(res, 404, { code:'PGRST202', message:'Could not find the function public.radar_put(p_expected_revision, p_id, p_payload)' });
      rows.set(p.p_id, { payload:p.p_payload, revision:(rows.get(p.p_id)?.revision||0)+1, updated_at:new Date().toISOString() });
      return send(res, 200, null);
    }
    const exp = ('p_expected_revision' in p) ? p.p_expected_revision : null;
    const cur = rows.get(p.p_id);
    if (!cur) {
      if (exp !== null && exp !== 0) return send(res, 200, [{ status:'conflict', revision:0, payload:null, updated_at:null }]);
      const at = new Date().toISOString();
      rows.set(p.p_id, { payload:p.p_payload, revision:1, updated_at:at });
      return send(res, 200, [{ status:'ok', revision:1, payload:null, updated_at:at }]);
    }
    if (exp !== null && exp !== cur.revision)
      return send(res, 200, [{ status:'conflict', revision:cur.revision, payload:cur.payload, updated_at:cur.updated_at }]);
    const at = new Date().toISOString();
    const nv = cur.revision + 1;
    rows.set(p.p_id, { payload:p.p_payload, revision:nv, updated_at:at });
    return send(res, 200, [{ status:'ok', revision:nv, payload:null, updated_at:at }]);
  }
  send(res, 404, { message:'no route' });
}).listen(8877, '127.0.0.1', () => console.log('mock on 8877'));
