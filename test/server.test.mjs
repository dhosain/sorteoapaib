import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('Servidor web: sesiones, origen, concurrencia, persistencia y cierre de sesión',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'apaib-web-'));
 let child,base;
 async function start(controlPassword='test-only-password-apaib'){
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',CONTROL_PASSWORD:controlPassword,PORT:'0',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
  let text='';await new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{text+=chunk;const m=text.match(/puerto (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});child.once('exit',code=>reject(Error('Server exited '+code)));child.once('error',reject);});
 }
 async function stop(){const p=child;const exited=once(p,'exit');p.kill();await exited;child=null;}
 async function post(body,cookie='',origin=base){return fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(body)});}
 try{
  await start();assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/control')).status,200);
  for(const path of ['/assets/fachada.png','/assets/logo.png']){const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await r.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);}
  assert.equal((await post({action:'begin',revision:0})).status,401);
  assert.equal((await post({action:'login',pin:'incorrect'})).status,403);
  assert.equal((await post({action:'login',pin:'test-only-password-apaib'},'','https://another-site.example')).status,403);
  const login=await post({action:'login',pin:'test-only-password-apaib'});assert.equal(login.status,200);const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);const cookie=header.split(';')[0];
  assert.equal((await fetch(base+'/api/session',{headers:{Cookie:cookie}}).then(r=>r.json())).authenticated,true);
  const enabled=await post({action:'enable',revision:0,numbers:Array.from({length:12},(_,i)=>i+1)},cookie);assert.equal(enabled.status,200);
  assert.equal((await post({action:'begin',revision:0},cookie)).status,409);
  assert.equal((await post({action:'begin',revision:1},cookie,'https://another-site.example')).status,403);
  const begun=await post({action:'begin',revision:1},cookie);assert.equal(begun.status,200);const saved=await begun.json();
  await stop();await start();assert.deepEqual(await fetch(base+'/api/state').then(r=>r.json()),saved);assert.equal((await fetch(base+'/api/session',{headers:{Cookie:cookie}}).then(r=>r.json())).authenticated,true);
  const again=await post({action:'login',pin:'test-only-password-apaib'});const cookie2=again.headers.get('set-cookie').split(';')[0];
  const rejectedReset=await post({action:'reset',revision:saved.revision,confirm:'invalid'},cookie2);assert.equal(rejectedReset.status,400);
  assert.deepEqual(await fetch(base+'/api/state').then(r=>r.json()),saved);
  const reset=await post({action:'reset',revision:saved.revision,confirm:'REINICIAR'},cookie2);assert.equal(reset.status,200);
  const clean=await reset.json();assert.equal(clean.phase,'setup');assert.deepEqual(clean.enabled,[]);assert.deepEqual(clean.finalists,[]);assert.deepEqual(clean.history,[]);assert.equal(clean.revision,saved.revision+1);
  await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie2}});
  assert.equal((await post({action:'spin',revision:2},cookie2)).status,401);
  for(let i=0;i<9;i++)assert.equal((await post({action:'login',pin:'wrong'})).status,403);
  assert.equal((await post({action:'login',pin:'wrong'})).status,429);
  await stop();await start('replacement-test-password');
  assert.equal((await fetch(base+'/api/session',{headers:{Cookie:cookie}}).then(r=>r.json())).authenticated,false);
  assert.equal((await post({action:'login',pin:'test-only-password-apaib'})).status,403);
  assert.equal((await post({action:'login',pin:'replacement-test-password'})).status,200);
  assert.deepEqual(await fetch(base+'/api/state').then(r=>r.json()),clean);
 }finally{if(child)await stop();await rm(dir,{recursive:true,force:true});}
});
