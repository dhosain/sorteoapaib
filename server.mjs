import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync,readdirSync} from 'node:fs';
import {randomInt,randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import {fresh,transition,publicState} from './game.mjs';
import {createStore} from './storage.mjs';
import {VERSION} from './public/config.js';
const production=process.env.NODE_ENV==='production';
const password=process.env.CONTROL_PASSWORD||(!production?String(randomInt(100000,1000000)):'');
if(!password||(production&&password.length<12)||password.length>256)throw Error('Configurar CONTROL_PASSWORD de 12 a 256 caracteres');
if(production&&!process.env.DATA_DIR)throw Error('Configurar DATA_DIR en un disco persistente');
const port=Number(process.env.PORT||3000),dir=process.env.DATA_DIR||'.data',store=createStore(dir);
store.read(); // Refuse to silently overwrite a damaged save file.
const sessionDir=dir+'/.sessions';mkdirSync(sessionDir,{recursive:true,mode:0o700});
const salt=randomBytes(16),hash=scryptSync(password,salt,32),attempts=new Map();
const authTag=createHmac('sha256',password).update('apaib-session-v3').digest('hex');
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
function token(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('apaib_session='))?.slice(14);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
function authorized(req){const t=token(req);if(!t)return false;try{const s=JSON.parse(readFileSync(sessionDir+'/'+t,'utf8'));return s.expires>Date.now()&&s.tag===authTag;}catch{return false;}}
const cookieOptions=`; HttpOnly; SameSite=Strict; Path=/${production?'; Secure':''}`;
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://localhost');
 try{
  if(url.pathname==='/healthz'){json(res,200,{ok:true,version:VERSION});return;}
  if(url.pathname==='/api/state'&&req.method==='GET'){json(res,200,{...publicState(store.read()),version:VERSION});return;}
  if(url.pathname==='/api/session'&&req.method==='GET'){json(res,200,{authenticated:authorized(req)});return;}
  if(req.method==='POST'&&['/api/action','/api/presented','/api/logout'].includes(url.pathname)){
   const origin=req.headers.origin;
   if(origin&&new URL(origin).host!==req.headers.host){res.writeHead(403);res.end('Origen inválido');return;}
   if(url.pathname==='/api/logout'){
    const t=token(req);if(t)try{unlinkSync(sessionDir+'/'+t);}catch{}
    res.setHeader('Set-Cookie','apaib_session=; Max-Age=0'+cookieOptions);json(res,200,{authenticated:false});return;
   }
   if(!(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end('Se requiere JSON');return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)throw Error('Solicitud demasiado grande');}
   const data=JSON.parse(body);
   if(url.pathname==='/api/presented'){
    const next=store.change(s=>{if(!s.revealed||s.revealed.presentationId!==data.presentationId)throw Error('El resultado ya cambió');return s.revealed.presented?s:transition(s,'presented',data);});
    json(res,200,{...publicState(next),version:VERSION});return;
   }
   if(data.action==='login'){
    const now=Date.now();let entry=attempts.get('login');if(!entry||entry.until<=now)entry={count:0,until:now+60000};attempts.set('login',entry);
    if(entry.count>=10){res.setHeader('Retry-After','60');res.writeHead(429);res.end('Demasiados intentos. Esperá un minuto.');return;}entry.count++;
    if(typeof data.pin!=='string'||data.pin.length>256||!timingSafeEqual(scryptSync(data.pin,salt,32),hash)){res.writeHead(403);res.end('Código incorrecto');return;}
    const t=randomBytes(32).toString('hex');writeFileSync(sessionDir+'/'+t,JSON.stringify({expires:now+43200000,tag:authTag}),{mode:0o600});
    res.setHeader('Set-Cookie',`apaib_session=${t}; Max-Age=43200`+cookieOptions);json(res,200,{authenticated:true});return;
   }
   if(!authorized(req)){res.writeHead(401);res.end('Ingresá nuevamente el código de control');return;}
   const next=store.change(s=>{
    if(data.revision!==s.revision){const e=Error('La pantalla cambió. Intentá nuevamente.');e.status=409;throw e;}
    if(data.action==='reset'){if(data.confirm!=='REINICIAR')throw Error('Confirmación inválida');return {...fresh(),revision:s.revision+1};}
    return transition(s,data.action,data);
   });
   json(res,200,{...publicState(next),version:VERSION});return;
  }
  const routes={'/':'index.html','/control':'index.html','/app.js':'app.js','/config.js':'config.js','/style.css':'style.css','/assets/fachada.png':'assets/Fachada desgastada con puerta azul.png','/assets/logo.png':'assets/Logo oficial fondo verde 480.png'};
  if(req.method!=='GET'||!routes[url.pathname]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',url.pathname.endsWith('.png')?'image/png':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(new URL('./public/'+routes[url.pathname],import.meta.url)));
 }catch(e){res.writeHead(e.status||400);res.end(e.message);}
});
setInterval(()=>{for(const name of readdirSync(sessionDir)){try{const s=JSON.parse(readFileSync(sessionDir+'/'+name,'utf8'));if(s.expires<Date.now())unlinkSync(sessionDir+'/'+name);}catch{}}},900000).unref();
server.listen(typeof PhusionPassenger !== 'undefined' ? 'passenger' : port,...(typeof PhusionPassenger !== 'undefined' ? [] : ['0.0.0.0']),()=>{console.log('APAIB · servidor activo · puerto '+(typeof server.address()==='string'?'Passenger':server.address().port));if(!production&&!process.env.CONTROL_PASSWORD)console.log('Código de control local: '+password);});
