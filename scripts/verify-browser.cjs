const {resolve,join}=require('node:path');const {pathToFileURL}=require('node:url');const project=resolve(__dirname,'..');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');const {mkdtempSync,writeFileSync,readFileSync}=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const {fresh,transition}=await import(pathToFileURL(join(project,'game.mjs')).href);
 let seed=transition(fresh(),'enable',{numbers:Array.from({length:120},(_,i)=>i+1)});seed=transition(seed,'begin');for(let i=0;i<10;i++){seed=transition(seed,'spin');seed=transition(seed,'stop');seed=transition(seed,'confirm');}
 const dir=mkdtempSync(join(require('node:os').tmpdir(),'apaib-v3-browser-'));writeFileSync(dir+'/game.json',JSON.stringify(seed));
 let server,browser,base;
 try{
  server=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,NODE_ENV:'development',PORT:'0',DATA_DIR:dir,CONTROL_PASSWORD:'browser-test-apaib'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',x=>{text+=x;const m=text.match(/puerto (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--autoplay-policy=user-gesture-required']});
  const screen=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];screen.on('pageerror',e=>errors.push(e.message));
  await screen.addInitScript(()=>{window.__contexts=[];window.__oscillators=[];const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...args){super(...args);window.__contexts.push(this);}createOscillator(){const o=super.createOscillator();window.__oscillators.push(o);return o;}};});
  await screen.goto(base);await screen.waitForSelector('.finalists-ready');assert.equal(await screen.locator('h1').textContent(),'APAIB - 97° Aniversario');assert.equal(await screen.locator('header small').count(),0);assert.equal(await screen.locator('#audio').textContent(),'Desactivar sonido');await screen.screenshot({path:join(dir,'finalists.png')});
  const selected=await screen.locator('.key.chosen').first().evaluate(e=>({bg:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color}));assert.deepEqual(selected,{bg:'rgb(255, 224, 0)',text:'rgb(17, 17, 17)'});
  await screen.locator('h1').click();await screen.waitForFunction(()=>window.__contexts[0]?.state==='running');
  const control=await browser.newPage({viewport:{width:390,height:844}});control.on('pageerror',e=>errors.push(e.message));await control.goto(base+'/control');await control.locator('#pin').fill('browser-test-apaib');await control.locator('#login').click();await control.getByRole('button',{name:'Preparar final'}).click();
  const actual=JSON.parse(readFileSync(dir+'/game.json','utf8'));const order=[...actual.finalists].sort((a,b)=>(actual.assignment[a].rank||6)-(actual.assignment[b].rank||6));let sizes=[];
  for(let i=0;i<order.length;i++){
   const n=order[i],outcome=actual.assignment[n];await control.locator(`[data-finalist="${n}"]`).click();await control.getByRole('button',{name:`Probar llave ${n}`}).click();await control.getByRole('button',{name:'Esperando que termine la presentación…'}).waitFor();assert.equal(await control.getByRole('button',{name:'Esperando que termine la presentación…'}).isDisabled(),true);
   if(outcome.opens){
    await screen.waitForSelector('.stage.open');
    if(i===0){await screen.waitForTimeout(900);const first=await screen.locator('.leaf').first().evaluate(e=>getComputedStyle(e).transform);await screen.screenshot({path:join(dir,'opening.png')});await screen.waitForTimeout(1300);const second=await screen.locator('.leaf').first().evaluate(e=>getComputedStyle(e).transform);assert.notEqual(first,second);assert.equal(await screen.locator('.winner').count(),0);}
    await screen.waitForSelector('.winner');sizes.push(await screen.locator('.winner strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok((await screen.locator('.winner strong').textContent()).includes(outcome.rank<=2?'Smart TV':outcome.rank===3?'aspiradora':outcome.rank===4?'Bluetooth':'smartwatch'));
    if(i===0){await screen.screenshot({path:join(dir,'tv.png')});assert.ok(await screen.evaluate(()=>window.__oscillators.filter(o=>o.type==='sawtooth').length>=7));}
   }else{
    await screen.waitForSelector('.no-opening');assert.equal(await screen.locator('.no-opening>span').textContent(),`Qué pena, tu llave ${n} no abrió la puerta`);assert.equal(await screen.locator('.no-opening>strong').textContent(),'¡Pero igual tenés un premio!');assert.equal(await screen.locator('text=/consuelo/i').count(),0);if(i===5)await screen.screenshot({path:join(dir,'no-opening.png')});
   }
   await control.getByRole('button',{name:'Premio entregado: continuar'}).click();
   if(i<9)await screen.waitForSelector('.stage:not(.open) .stage-message');
   console.log('Intento '+(i+1)+': '+(outcome.opens?outcome.prize:'no abrió')+' · presentación confirmada');
  }
  assert.ok(sizes.every((v,i)=>i===0||sizes[i-1]>v));await screen.waitForSelector('.stage.finished');await screen.screenshot({path:join(dir,'finale.png')});
  const final=await fetch(base+'/api/state').then(r=>r.json());assert.deepEqual(final.tally,{attempts:10,main:5,other:5});assert.equal(final.integrity.valid,true);
  await screen.locator('#audio').click();assert.equal(await screen.locator('#audio').textContent(),'Activar sonido');await screen.reload();await screen.waitForSelector('#audio');assert.equal(await screen.locator('#audio').textContent(),'Activar sonido');await screen.locator('#audio').click();assert.equal(await screen.locator('#audio').textContent(),'Desactivar sonido');
  await control.locator('summary').click();await control.locator('#reset').click();await control.locator('#reset-dialog [data-confirm]').click();await screen.waitForSelector('.stage:not(.finished) .stage-message');assert.equal((await fetch(base+'/api/state').then(r=>r.json())).phase,'setup');assert.deepEqual(errors,[]);
  console.log('Capturas de la prueba: '+dir);
  console.log('Navegador: 10 intentos, 5 principales + 5 sin apertura, mensajes, audio, apertura lenta, final y reinicio: OK');
 }finally{await browser?.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
