import http from 'node:http';

let statusRequests=0;
const send=(res,body)=>{
  res.writeHead(200,{
    'content-type':'application/json',
    'access-control-allow-origin':'*',
    'cache-control':'public, max-age=31536000'
  });
  res.end(JSON.stringify(body));
};

http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/rest/v1/radar_feed_items') return send(res,[]);
  if(url.pathname==='/rest/v1/radar_feed_status') {
    statusRequests++;
    console.log(`status request ${statusRequests}: ${req.headers['cache-control']||'no-cache-header'}`);
    return send(res,[{status:'ok',completed_at:new Date().toISOString(),candidate_count:0,checked_company_count:50}]);
  }
  if(url.pathname==='/__stats') return send(res,{statusRequests});
  res.writeHead(404); res.end('not found');
}).listen(8878,'127.0.0.1',()=>console.log('feed cache fixture on 8878'));
