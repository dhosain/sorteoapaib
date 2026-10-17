const {resolve,join}=require('node:path');const {pathToFileURL}=require('node:url');const project=resolve(__dirname,'..');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');const {mkdtempSync,writeFileSync,readFileSync}=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const {fresh,transition}=await import(pathToFileURL(join(project,'game.mjs')).href);
 let seed=transition(fresh(),'enable',{numbers:Array.from({length:120},(_,i)=>i+1)});seed=transition(seed,'begin');for(let i=0;i<8;i++){seed=transition(seed,'spin');seed=transition(seed,'stop');seed=transition(seed,'confirm');}
 const dir=mkdtempSync(join(require('node:os').tmpdir(),'apaib-v3-browser-'));writeFileSync(dir+'/game.json',JSON.stringify(seed));
 let server,browser,base;
 try{
  server=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,NODE_ENV:'development',PORT:'0',DATA_DIR:dir,CONTROL_PASSWORD:'browser-test-apaib'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',x=>{text+=x;const m=text.match(/puerto (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--autoplay-policy=user-gesture-required']});
  const screen=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'}),errors=[];screen.on('pageerror',e=>errors.push(e.message));
  await screen.addInitScript(()=>{window.__contexts=[];window.__oscillators=[];window.__audioEvents=[];window.__marks=[];document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const stage=document.querySelector('.stage.open');if(stage&&!window.__marks.some(m=>m.id===stage.dataset.presentation)){window.__marks.push({id:stage.dataset.presentation,time:performance.now(),announced:!!stage.querySelector('.winner')});}}).observe(document.body,{subtree:true,childList:true,attributes:true}));const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...args){super(...args);window.__contexts.push(this);}createOscillator(){const o=super.createOscillator();window.__oscillators.push(o);const start=o.start.bind(o);o.start=(...args)=>{window.__audioEvents.push({type:o.type,time:performance.now()});return start(...args);};return o;}};});
  await screen.goto(base);await screen.waitForSelector('.stage');assert.equal(await screen.locator('h1').textContent(),'APAIB - 97° Aniversario');assert.equal(await screen.locator('header small').count(),0);assert.equal(await screen.locator('#audio').count(),0);await screen.screenshot({path:join(dir,'finalists.png')});
  const selected=await screen.locator('.key.chosen').first().evaluate(e=>({bg:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color}));assert.deepEqual(selected,{bg:'rgb(255, 224, 0)',text:'rgb(17, 17, 17)'});
  await screen.locator('#start-presentation').click();await screen.waitForFunction(()=>window.__contexts[0]?.state==='running');
  // Render the actual gain/compressor graph offline and measure output level.
  const levels=await screen.evaluate(async()=>{
   const {createAudio}=await import('/audio.js');
   const context=new OfflineAudioContext(1,44100*3,44100);Object.defineProperty(context,'state',{value:'running'});
   const engine=createAudio({volume:.85,contextFactory:()=>context});await engine.unlock();await engine.fanfare();
   const output=await context.startRendering(),data=output.getChannelData(0);let peak=0,sum=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
   const legacy=new OfflineAudioContext(1,44100*3,44100);
   for(const [f,t,d] of [[523,0,.22],[523,.26,.22],[659,.52,.3],[784,.86,.32],[1047,1.22,1.4],[659,1.22,1.4],[784,1.22,1.4]]){const o=legacy.createOscillator(),g=legacy.createGain(),filter=legacy.createBiquadFilter();o.type='sawtooth';o.frequency.value=f;filter.type='lowpass';filter.frequency.value=2200;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.065,t+.06);g.gain.setValueAtTime(.05,t+d*.65);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(filter);filter.connect(g);g.connect(legacy.destination);o.start(t);o.stop(t+d);}
   const previous=(await legacy.startRendering()).getChannelData(0);let oldSum=0;for(const sample of previous)oldSum+=sample*sample;
   return {peak,rms:Math.sqrt(sum/data.length),oldRms:Math.sqrt(oldSum/previous.length)};
  });assert.ok(levels.rms>.06,'Nivel de fanfarria insuficiente: '+levels.rms);assert.ok(levels.peak<1,'Picos recortados: '+levels.peak);assert.ok(levels.rms>levels.oldRms*2,'No aumentó el nivel respecto de la edición anterior');console.log('Audio medido: RMS '+levels.rms.toFixed(3)+' · pico '+levels.peak.toFixed(3));
  const control=await browser.newPage({viewport:{width:390,height:844}});control.on('pageerror',e=>errors.push(e.message));await control.goto(base+'/control');await control.locator('#pin').fill('browser-test-apaib');await control.locator('#login').click();await control.locator('.control-progress').waitFor();assert.equal(await control.locator('.control-progress').textContent(),'Llaves elegidas: 8/10');assert.equal(await control.getByText('Intentos finales completados:',{exact:false}).count(),0);await control.screenshot({path:join(dir,'selection-eight.png')});
  for(let i=0;i<2;i++){await control.getByRole('button',{name:'Iniciar selección'}).click();await control.getByRole('button',{name:'DETENER Y REVELAR'}).click();await control.getByRole('button',{name:'Está presente: confirmar'}).click();}
  await screen.waitForSelector('.finalists-ready');await control.getByRole('button',{name:'Preparar final'}).click();await control.getByText('Intentos finales completados:',{exact:false}).waitFor();
  const actual=JSON.parse(readFileSync(dir+'/game.json','utf8'));const order=[...actual.finalists].sort((a,b)=>(actual.assignment[a].rank||6)-(actual.assignment[b].rank||6));let sizes=[];
  for(let i=0;i<order.length;i++){
   const n=order[i],outcome=actual.assignment[n];if(i===1){await screen.evaluate(()=>window.__contexts[0].suspend());await screen.waitForFunction(()=>window.__contexts[0].state==='suspended');}await control.locator(`[data-finalist="${n}"]`).click();await control.getByRole('button',{name:`Probar llave ${n}`}).click();await control.getByRole('button',{name:'Esperando que termine la presentación…'}).waitFor();assert.equal(await control.getByRole('button',{name:'Esperando que termine la presentación…'}).isDisabled(),true);
   if(outcome.opens){
    await screen.waitForSelector('.stage.open');
    if(i===0){await screen.waitForTimeout(900);assert.equal(await screen.locator('.winner').count(),0);assert.equal(await screen.locator('.particle').count(),0);assert.equal(await screen.evaluate(()=>window.__audioEvents.some(x=>x.type==='sawtooth')),false);const first=await screen.locator('.leaf').first().evaluate(e=>getComputedStyle(e).transform);await screen.screenshot({path:join(dir,'opening.png')});await screen.waitForTimeout(1300);const second=await screen.locator('.leaf').first().evaluate(e=>getComputedStyle(e).transform);assert.notEqual(first,second);assert.equal(await screen.locator('.winner').count(),1);
     const timing=await screen.evaluate(()=>({mark:window.__marks[0],brass:window.__audioEvents.find(x=>x.type==='sawtooth')}));assert.equal(timing.mark.announced,false);const delay=timing.brass.time-timing.mark.time;assert.ok(delay>=1400&&delay<2000,'Demora del anuncio/fanfarria: '+delay+' ms');assert.equal(await control.getByRole('button',{name:'Esperando que termine la presentación…'}).isDisabled(),true);
     console.log('Contador 8/10, apertura lenta con movimiento reducido del sistema y anuncio + fanfarria demorados 1,5 segundos: OK');}
    await screen.waitForSelector('.winner');if(i===1){await screen.waitForFunction(()=>window.__contexts[0].state==='running');console.log('Contexto suspendido: recuperación automática en el siguiente premio OK');}sizes.push(await screen.locator('.winner strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok((await screen.locator('.winner strong').textContent()).includes(outcome.rank<=2?'Smart TV':outcome.rank===3?'aspiradora':outcome.rank===4?'Bluetooth':'smartwatch'));
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
  const beforeSettings=(await fetch(base+'/api/state').then(r=>r.json())).revision;
  await control.locator('#audio-volume').evaluate(el=>{el.value='55';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await control.waitForFunction(()=>document.querySelector('#audio-level')?.textContent==='55%');
  await screen.evaluate(()=>window.__contexts[0].suspend());await screen.waitForFunction(()=>window.__contexts[0].state==='suspended');await control.locator('#audio-test').click();await screen.waitForFunction(()=>window.__contexts[0].state==='running');
  await control.locator('#audio').click();await control.waitForFunction(()=>document.querySelector('#audio').textContent==='Activar sonido');await screen.waitForTimeout(1000);await screen.reload();await screen.waitForSelector('.stage');assert.equal(await screen.locator('#audio').count(),0);assert.equal(await control.locator('#audio-volume').inputValue(),'55');
  await screen.locator('#start-presentation').click();await control.locator('#audio').click();await control.waitForFunction(()=>document.querySelector('#audio').textContent==='Desactivar sonido');
  await control.locator('#motion').click();await screen.waitForSelector('.stage.reduce-motion');await control.locator('#motion').click();await screen.waitForSelector('.stage:not(.reduce-motion)');
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).revision,beforeSettings);
  console.log('Móvil: volumen, prueba en proyector, silencio y movimiento remotos sin alterar la partida: OK');
  await control.locator('summary').click();await control.locator('#reset').click();await control.locator('#reset-dialog [data-confirm]').click();await screen.waitForSelector('.stage:not(.finished) .stage-message');assert.equal((await fetch(base+'/api/state').then(r=>r.json())).phase,'setup');assert.deepEqual(errors,[]);
  console.log('Capturas de la prueba: '+dir);
  console.log('Navegador: 10 intentos, 5 principales + 5 sin apertura, mensajes, audio, apertura lenta, final y reinicio: OK');
 }finally{await browser?.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
