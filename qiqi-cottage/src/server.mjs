import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { handleApi } from './api.mjs';
import { sqliteAdapter } from './database.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(resolve(root,'.data'),{recursive:true});
const db=sqliteAdapter(process.env.DATABASE_PATH||resolve(root,'.data/cottage.sqlite'));
db.exec(await readFile(resolve(root,'migrations/0001_initial.sql'),'utf8'));
const foods=JSON.parse(await readFile(resolve(root,'public/menu.json'),'utf8'));
await db.batch(foods.map(f=>db.prepare('INSERT INTO foods(id,name_zh,name_en,description_zh,description_en,category,image,active,ice_options,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(f.id,f.name.zh,f.name.en,f.description.zh,f.description.en,f.category,f.image,1,f.iceOptions?1:0,f.sortOrder)));
const publicRoot=resolve(root,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin=process.env.SITE_ORIGIN||`http://${host}`;
    const url=new URL(req.url,origin);
    if(url.pathname.startsWith('/api/')){
      const chunks=[];let total=0;
      for await (const chunk of req){total+=chunk.length;if(total>200000){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"imageTooLarge"}');return}chunks.push(chunk)}
      const body=Buffer.concat(chunks);
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})});
      const response=await handleApi(request,{DB:db,INVITE_CODE:process.env.INVITE_CODE,OWNER_USERNAME:process.env.OWNER_USERNAME||'qiqi',OWNER_SETUP_CODE:process.env.OWNER_SETUP_CODE,SITE_ORIGIN:origin,CLIENT_IP:req.socket.remoteAddress});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let name=decodeURIComponent(url.pathname);if(name.endsWith('/'))name+='index.html';
    const path=resolve(publicRoot,'.'+name);
    if(!path.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
    let file;try{file=await readFile(path)}catch{res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:file);
  }catch{res.writeHead(500);res.end('Internal server error')}
});
const port=Number(process.env.PORT)||8788;
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`QiQi Cottage is running at http://${process.env.HOST||'127.0.0.1'}:${port}`));
function stop(){server.close(()=>{db.close();process.exit(0)})}process.on('SIGINT',stop);process.on('SIGTERM',stop);
