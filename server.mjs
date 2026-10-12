import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {randomInt,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {fresh,transition,publicState} from './game.mjs';
const production=process.env.NODE_ENV==='production';
const password=process.env.CONTROL_PASSWORD||(!production?String(randomInt(100000,1000000)):'');
if(!password||(production&&password.length<12))throw Error('Configurar CONTROL_PASSWORD de al menos 12 caracteres');
if(production&&!process.env.DATA_DIR)throw Error('Configurar DATA_DIR en un disco persistente');
const port=Number(process.env.PORT||3000),dir=process.env.DATA_DIR||'.data';mkdirSync(dir,{recursive:true});
const file=dir+'/game.json';let state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):fresh();
const salt=randomBytes(16),hash=scryptSync(password,salt,32),clients=new Set(),sessions=new Map(),attempts=new Map();
const lifetime=12*60*60*1000;
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
function save(next){writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(file+'.tmp',file);state=next;for(const res of clients)res.write('data: '+JSON.stringify(publicState(state))+'\n\n');}
function authorized(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('apaib_session='))?.slice(14);return sessions.get(token)>Date.now();}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('apaib_session='))?.slice(14);sessions.delete(token);res.setHeader('Set-Cookie','apaib_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(production?'; Secure':''));json(res,200,{authenticated:false});return;}
 if(url.pathname==='/healthz'){json(res,200,{ok:true});return;}
 if(url.pathname==='/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('data: '+JSON.stringify(publicState(state))+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(url.pathname==='/api/state'&&req.method==='GET'){json(res,200,publicState(state));return;}
 if(url.pathname==='/api/session'&&req.method==='GET'){json(res,200,{authenticated:authorized(req)});return;}
 if(url.pathname==='/api/action'&&req.method==='POST'){
 try{
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host){res.writeHead(403);res.end('Origen inválido');return;}
  if(!(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end('Se requiere JSON');return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)throw Error('Solicitud demasiado grande');}
  const data=JSON.parse(body);
  if(data.action==='login'){
   // Global limit avoids trusting spoofable proxy/IP headers. Limits attempts across all clients.
   const key='login',now=Date.now();let entry=attempts.get(key);if(!entry||entry.until<=now)entry={count:0,until:now+60000};attempts.set(key,entry);
   if(entry.count>=10){res.setHeader('Retry-After','60');res.writeHead(429);res.end('Demasiados intentos. Esperá un minuto.');return;}
   entry.count++;
   if(typeof data.pin!=='string'||data.pin.length>256||!timingSafeEqual(scryptSync(data.pin,salt,32),hash)){res.writeHead(403);res.end('Código incorrecto');return;}
   const token=randomBytes(32).toString('hex');sessions.set(token,now+lifetime);
   res.setHeader('Set-Cookie',`apaib_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${production?'; Secure':''}`);json(res,200,{authenticated:true});return;
  }
  if(!authorized(req)){res.writeHead(401);res.end('Ingresá nuevamente el código de control');return;}
  if(data.revision!==state.revision){res.writeHead(409);res.end('La pantalla cambió. Intentá nuevamente.');return;}
  if(data.action==='reset'){if(data.confirm!=='REINICIAR')throw Error('Confirmación inválida');save({...fresh(),revision:state.revision+1});}else save(transition(state,data.action,data));json(res,200,publicState(state));
 }catch(e){res.writeHead(400);res.end(e.message);}return;}
 const routes={'/':'index.html','/control':'index.html','/app.js':'app.js','/style.css':'style.css','/assets/fachada.png':'assets/Fachada desgastada con puerta azul.png','/assets/logo.png':'assets/Logo oficial fondo verde 480.png'};if(req.method!=='GET'||!routes[url.pathname]){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',url.pathname.endsWith('.png')?'image/png':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(new URL('./public/'+routes[url.pathname],import.meta.url)));
});
setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');for(const [k,v] of sessions)if(v<Date.now())sessions.delete(k);},15000).unref();
server.listen(typeof PhusionPassenger !== 'undefined' ? 'passenger' : port,...(typeof PhusionPassenger !== 'undefined' ? [] : ['0.0.0.0']),()=>{console.log('APAIB · servidor activo · puerto '+(typeof server.address()==='string'?'Passenger':server.address().port));if(!production&&!process.env.CONTROL_PASSWORD)console.log('Código de control local: '+password);});
