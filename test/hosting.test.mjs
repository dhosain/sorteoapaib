import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('Dos procesos del hosting comparten sesión y partida: diez intentos, cinco aperturas, ningún avance prematuro',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'apaib-workers-')),workers=[];
 async function start(){
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',CONTROL_PASSWORD:'test-workers-password',PORT:'0',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});workers.push(child);
  return await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',x=>{output+=x;const m=output.match(/puerto (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});child.once('exit',code=>reject(Error('Worker exited '+code)));child.once('error',reject);});
 }
 try{
  const a=await start(),b=await start();let cookie='';
  const get=base=>fetch(base+'/api/state').then(r=>r.json());
  const post=(base,path,data)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base},body:JSON.stringify(data)});
  const login=await post(a,'/api/action',{action:'login',pin:'test-workers-password'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  let index=0;
  async function action(action,data={}){const base=index++%2?a:b;const s=await get(base);const response=await post(base,'/api/action',{action,revision:s.revision,...data});assert.equal(response.status,200,await response.clone().text());return response.json();}
  await action('enable',{numbers:Array.from({length:130},(_,i)=>i+1)});let s=await action('begin');
  const race=await Promise.all([post(a,'/api/action',{action:'spin',revision:s.revision}),post(b,'/api/action',{action:'spin',revision:s.revision})]);assert.equal(race.filter(r=>r.status===200).length,1);assert.ok(race.every(r=>[200,400,409].includes(r.status)));
  await action('stop');await action('confirm');
  for(let i=1;i<10;i++){await action('spin');await action('stop');await action('confirm');}
  s=await action('final');const ids=[...s.finalists].reverse();
  for(const number of ids){
   await action('select',{number});s=await action('reveal');const presentationId=s.revealed.presentationId;
   const premature=await post(a,'/api/action',{action:'next',revision:s.revision});assert.equal(premature.status,400);assert.match(await premature.text(),/pantalla principal/);
   const wrong=await post(b,'/api/presented',{presentationId:'viejo'});assert.equal(wrong.status,400);
   assert.equal((await post(b,'/api/presented',{presentationId})).status,200);
   assert.equal((await post(a,'/api/presented',{presentationId})).status,200);
   await action('next');
  }
  const finalA=await get(a),finalB=await get(b);assert.deepEqual(finalA,finalB);assert.equal(finalA.phase,'done');assert.deepEqual(finalA.tally,{attempts:10,main:5,other:5});assert.equal(finalA.integrity.valid,true);
  const disk=JSON.parse(await readFile(dir+'/game.json','utf8'));assert.equal(disk.completed.length,10);assert.equal(disk.history.filter(x=>x.event==='premio'&&x.opens).length,5);
 }finally{await Promise.all(workers.map(async p=>{if(p.exitCode===null){const ended=once(p,'exit');p.kill();await ended;}}));await rm(dir,{recursive:true,force:true});}
});
