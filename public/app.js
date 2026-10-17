import {createAudio} from '/audio.js?v=3.1.0';
import {VERSION,PRIZES,OPENING_MS,TRY_MS,ANNOUNCE_DELAY_MS} from '/config.js?v=3.1.0';
const app=document.querySelector('#app'),control=location.pathname==='/control';let state,pin='',authenticated=false,sound=localStorage.getItem('apaib-sound')!=='off',selected=new Set(),editing=false,lastReveal='',timer,highlight,reduceMotion=false,presentation,lastTestId,lastStatusPost=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const audio=createAudio({enabled:sound,volume:Number(localStorage.getItem('apaib-volume')??.85),onStatus:()=>updateAudio()});
function tone(frequency=440,duration=.15){if(!control)return audio.tone(frequency,duration);}
function fanfare(){return audio.fanfare();}
async function unlockAudio(){if(!control&&sound)await audio.unlock();}
function updateAudio(){
 if(control)return;
 const status=audio.status(),hint=document.querySelector('#audio-hint');
 if(hint){hint.hidden=!window.presentationStarted||!sound||status==='ready';hint.textContent=status==='silent'?'El volumen está en cero. Ajustalo desde el control.':status==='blocked'?'Audio pausado · Tocá aquí para recuperarlo':'Tocá aquí para habilitar el audio';}
 reportAudio();
}
function reportAudio(){
 if(control||Date.now()-lastStatusPost<1000)return;
 lastStatusPost=Date.now();fetch('/api/display-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:audio.status()})}).catch(()=>{});
}
function remoteAudioStatus(){
 const display=presentation?.display;
 if(!display||Date.now()-display.seenAt>10000)return 'Pantalla sin conexión reciente. Abrí la presentación en la computadora.';
 return {ready:'Pantalla conectada · Audio listo',muted:'Pantalla conectada · Sonido desactivado',silent:'Pantalla conectada · Volumen en cero',locked:'Tocá Iniciar presentación en la computadora para habilitar audio',blocked:'Audio pausado: tocá el aviso en la computadora para recuperarlo'}[display.state];
}
async function savePresentation(patch){
 try{
  const response=await fetch('/api/presentation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:presentation.revision,patch})});
  if(!response.ok)throw Error(await response.text());applyPresentation(await response.json());
 }catch(e){const error=document.querySelector('#error');if(error)error.textContent=e.message;}
}
function applyPresentation(next){
 if(!next)return;
 const changed=!presentation||next.revision!==presentation.revision,first=!presentation;
 presentation=next;
 if(control){if(changed&&state)renderControl();const status=document.querySelector('#audio-remote-status');if(status)status.textContent=remoteAudioStatus();return;}
 if(changed){
  sound=next.sound;reduceMotion=next.reduceMotion;audio.setEnabled(sound);audio.setVolume(next.volume);
  document.querySelector('.stage')?.classList.toggle('reduce-motion',reduceMotion);
  if(!first&&next.testId&&next.testId!==lastTestId&&Date.now()-next.testAt<4000)audio.fanfare();
  lastTestId=next.testId;updateAudio();
 }
}
setInterval(reportAudio,3000);
document.addEventListener('pointerdown',unlockAudio,{passive:true});
document.addEventListener('keydown',unlockAudio);
window.addEventListener('focus',()=>{if(!control&&sound)audio.recover();});
document.addEventListener('visibilitychange',()=>{if(!control&&sound&&document.visibilityState==='visible')audio.recover();});
function selectedKeys(){return state.finalists.length?`<div class="chosen-summary"><b>Llaves elegidas:</b><div class="summary">${state.finalists.map(n=>`<span>${n}${state.completed.includes(n)?' ✓':''}</span>`).join('')}</div></div>`:'';}
async function acknowledge(presentationId){
 if(state.revealed?.presentationId!==presentationId)return;
 try{const r=await fetch('/api/presented',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({presentationId})});if(!r.ok)throw Error('No se pudo confirmar');}
 catch{setTimeout(()=>acknowledge(presentationId),1500);}
}
async function send(action,data={}){
 try{
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,pin,revision:state?.revision,...data})});
  if(!r.ok){if(r.status===401){authenticated=false;render();}throw Error(await r.text());}
  const result=await r.json();
  if(action==='login'){authenticated=true;pin='';render();return true;}
  editing=false;
  if(!state||result.revision>=state.revision){state=result;render();}
  return true;
 }catch(e){
  if(action==='login'){pin='';authenticated=false;}
  const el=document.querySelector('.reset-error')||document.querySelector('#error');
  if(el)el.textContent=e.message;else alert(e.message);
  return false;
 }
}
function confirmReset(){
 if(document.querySelector('#reset-dialog'))return;
 const revision=state.revision;
 const dialog=document.createElement('dialog');dialog.id='reset-dialog';dialog.className='reset-dialog';
 dialog.innerHTML='<h2>¿Reiniciar la partida?</h2><p>Se borrarán las llaves habilitadas, los finalistas y todos los resultados. Esta acción no se puede deshacer.</p><p class="reset-error error" role="alert"></p><div class="actions"><button class="secondary" data-cancel>Cancelar</button><button class="danger" data-confirm>Reiniciar partida</button></div>';
 document.body.append(dialog);dialog.showModal();
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>dialog.remove());
 dialog.querySelector('[data-confirm]').onclick=async()=>{
  const button=dialog.querySelector('[data-confirm]');button.disabled=true;button.textContent='Reiniciando…';
  if(await send('reset',{confirm:'REINICIAR',revision}))dialog.close();
  else{button.disabled=false;button.textContent='Reiniciar partida';}
 };
}
function prizeMessage(r){return PRIZES.find(p=>p.rank===r.rank)?.message||'¡Ganaste un premio!';}

function prizeArtwork(r){
 const drawing=r.rank<=2?`<rect x="12" y="25" width="156" height="96" rx="6" fill="#101b29"/><rect x="19" y="32" width="142" height="82" rx="2" fill="url(#prize-glow)"/><path d="M60 133h60M90 122v11" stroke="#dbe3e7" stroke-width="6"/><text x="90" y="85" text-anchor="middle" fill="white" font-size="30">${r.rank===1?'55':'40'}″</text>`:r.rank===3?'<ellipse cx="90" cy="111" rx="68" ry="19" fill="#0005"/><ellipse cx="90" cy="84" rx="66" ry="44" fill="#d5dde0"/><ellipse cx="90" cy="77" rx="66" ry="44" fill="#f0f4f5"/><circle cx="90" cy="65" r="17" fill="#556777"/><circle cx="90" cy="65" r="11" fill="#9caebb"/><path d="M51 94h78" stroke="#7b8c99" stroke-width="3"/>':r.rank===4?'<rect x="49" y="15" width="82" height="126" rx="15" fill="#243443"/><circle cx="90" cy="50" r="19" fill="#0d1923" stroke="#8196a0" stroke-width="3"/><circle cx="90" cy="103" r="26" fill="#101d28" stroke="#8196a0" stroke-width="3"/><circle cx="90" cy="103" r="11" fill="#456270"/>':'<rect x="69" y="1" width="42" height="154" rx="12" fill="#254b46"/><rect x="48" y="38" width="84" height="82" rx="21" fill="#a9b9be"/><rect x="54" y="44" width="72" height="70" rx="16" fill="#10232b"/><path d="M90 56v24l18 9" fill="none" stroke="#dfbc71" stroke-width="5"/><circle cx="90" cy="80" r="3" fill="#dfbc71"/>';
 return `<svg class="prize-art" viewBox="0 0 180 156" aria-label="${esc(r.prize)}" role="img"><defs><linearGradient id="prize-glow"><stop stop-color="#2788ae"/><stop offset="1" stop-color="#853c91"/></linearGradient></defs>${drawing}</svg>`;
}

function message(){if(state.integrity?.valid===false)return 'La partida requiere revisión. Abrí Administración.';if(state.phase==='setup')return 'La puerta de los premios está por abrir su historia';if(state.spinning)return '¿Qué llave será la elegida?';if(state.pending)return `Llave <strong>${state.pending}</strong> · ¡Acercate para confirmar!`;if(state.phase==='draw')return state.finalists.length===10?'¡Ya tenemos los 10 finalistas!':`Turno ${Math.min(5,Math.floor(state.finalists.length/2)+1)} de 5 · ${state.finalists.length%2===0?'Primera':'Segunda'} plaza`;if(state.phase==='done')return '¡Gracias por celebrar los 97 años de APAIB!';if(state.revealed)return control?(state.revealed.opens?prizeMessage(state.revealed):`Qué pena, tu llave ${state.revealed.number} no abrió la puerta. ¡Pero igual tenés un premio!`):'Probando la llave…';if(state.active)return `Llave <strong>${state.active}</strong> · ¿Abrirá la puerta?`;return 'Final · Que se acerque quien quiera intentar';}
function render(){if(!state)return;if(!control&&state.integrity?.valid&&state.revealed?.presentationId&&document.querySelector('.stage')?.dataset.presentation===state.revealed.presentationId)return;if(control){renderControl();return;}app.innerHTML=`<main class="stage ${state.phase==='done'?'finished':''} ${reduceMotion?'reduce-motion':''}"><header><img class="brand-logo" src="/assets/logo.png" alt="Logo de APAIB"><h1>APAIB - 97° Aniversario</h1><div>Una puerta. Una historia. Una llave. Una sorpresa.</div></header><div class="scene"><div class="keys">${keys(1,65)}</div><div class="doorframe"><div class="inside" id="prize"></div><div class="leaves"><div class="leaf"></div><div class="leaf"></div></div></div><div class="keys">${keys(66,130)}</div></div><div class="banner ${state.finalists.length===10&&state.phase==='draw'?'finalists-ready':''}" id="banner" role="status" aria-live="polite"><div class="stage-message">${message()}</div>${selectedKeys()}${state.phase==='done'?`<div class="final-results">${state.history.filter(x=>x.event==='premio').map(x=>`<span>Llave ${x.number}: ${x.opens?esc(x.prize):'Premio'}</span>`).join('')}</div>`:''}</div>${!state.integrity?.valid?`<div class="integrity-warning">${esc(state.integrity?.message||'')}</div>`:''}<div class="connection-warning" hidden>Sin conexión · Esperando al servidor</div><button id="start-presentation">Iniciar presentación</button><button id="audio-hint" hidden></button></main>`;
 document.querySelector('#start-presentation').hidden=!!window.presentationStarted;
 document.querySelector('#start-presentation').onclick=async()=>{window.presentationStarted=true;document.querySelector('#start-presentation').hidden=true;document.documentElement.requestFullscreen?.().catch(()=>{});await audio.unlock();updateAudio();};
 document.querySelector('#audio-hint').onclick=unlockAudio;updateAudio();

 clearInterval(timer);if(state.spinning)timer=setInterval(()=>{const pool=state.enabled.filter(n=>!state.finalists.includes(n)&&!state.absent.includes(n));document.querySelector('.glow')?.classList.remove('glow');highlight=pool[Math.floor(Math.random()*pool.length)];document.querySelector(`[data-key="${highlight}"]`)?.classList.add('glow');tone(300+Math.random()*500,.07);},125);
 if(state.revealed&&state.integrity?.valid){const signature=state.revealed.presentationId||state.revealed.number+':'+state.revision;document.querySelector('.stage').dataset.presentation=signature;if(signature!==lastReveal){lastReveal=signature;reveal(state.revealed,!state.revealed.presented);}else reveal(state.revealed,false);}}
function keys(a,b){return Array.from({length:b-a+1},(_,i)=>{const n=a+i;return `<div data-key="${n}" class="key ${!state.enabled.includes(n)||state.absent.includes(n)?'disabled':''} ${state.finalists.includes(n)?'chosen':''} ${state.pending===n?'glow':''}"><svg class="key-icon" viewBox="0 0 28 14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7h14m-4 0v4m-5-4v3" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>${n}</span></div>`;}).join('');}
function reveal(r,animate){
 const stage=document.querySelector('.stage'),prize=stage.querySelector('#prize'),banner=stage.querySelector('#banner');
 const definition=PRIZES.find(p=>p.rank===r.rank);const tier=definition?.size||'fifth';
 if(r.opens)prize.innerHTML=`${prizeArtwork(r)}<span class="prize-label">${esc(r.prize)}</span>`;
 const announce=()=>{
  if(!stage.isConnected)return;
  banner.classList.add('result-banner');
  if(r.opens){banner.classList.add('winner',`prize-${tier}`);banner.innerHTML=`<strong>${prizeMessage(r)}</strong><span class="winner-number">Llave ${r.number} · ${r.rank}º premio</span>`;}
  else{banner.classList.add('no-opening');banner.innerHTML=`<span>Qué pena, tu llave ${r.number} no abrió la puerta</span><strong>¡Pero igual tenés un premio!</strong>`;}
  banner.insertAdjacentHTML('beforeend',selectedKeys());
  if(animate){
   if(r.opens)fanfare();else tone(220,.5);
   if(r.opens){const count=definition?.confetti||60;
    for(let i=0;i<count;i++){const p=document.createElement('i');p.className='particle';p.style.left=Math.random()*100+'%';p.style.background=['#f1cf71','#fff','#168154','#7dbeec'][i%4];p.style.animationDelay=Math.random()+'s';stage.append(p);setTimeout(()=>p.remove(),4500);}
   }
  }
  if(!r.presented)setTimeout(()=>{if(stage.isConnected)acknowledge(r.presentationId);},animate?(r.opens?Math.max(OPENING_MS-ANNOUNCE_DELAY_MS,2700):2700):300);
 };
 const open=()=>{
  if(!stage.isConnected)return;
  stage.classList.remove('trying');
  if(r.opens){
   // Paint the closed doors before changing their transforms. Keep the
   // leaves visible below 90 degrees, rotating inward around their hinges.
   void stage.querySelector('.leaf').offsetWidth;stage.classList.add('open');
   if(animate){banner.innerHTML='La puerta se está abriendo…'+selectedKeys();setTimeout(announce,ANNOUNCE_DELAY_MS);}
   else announce();
  }else announce();
 };
 if(animate){stage.classList.add('trying');tone(180,1);setTimeout(open,TRY_MS);}
 else{stage.classList.add('settled');open();}
}

function renderControl(){if(!authenticated){app.innerHTML=`<div class="panel"><h1>APAIB · Control</h1><small>Versión ${VERSION}</small><p>Ingresá el código privado de control del evento.</p><input id="pin" type="password" autocomplete="current-password" placeholder="Código de control"><button id="login">Conectar</button><p id="error" class="error"></p></div>`;document.querySelector('#login').onclick=async()=>{pin=document.querySelector('#pin').value;await send('login');};return;}if(!editing)selected=new Set(state.enabled);
 app.innerHTML=`<div class="panel"><h1>APAIB · Control</h1><small>Versión ${VERSION}</small><p class="status" id="connection">Conectado</p><div class="card"><p class="control-progress">Llaves elegidas: <strong>${state.finalists.length}/10</strong></p>${['final','done'].includes(state.phase)?`<p class="control-progress">Intentos finales completados: <strong>${state.completed.length}/10</strong></p>`:''}<p>${message()}</p>${!state.integrity?.valid?`<p class="error">${esc(state.integrity?.message||'')}</p>`:''}${['final','done'].includes(state.phase)?`<p>Resultados registrados: ${state.tally?.attempts||0}/10 · Principales: ${state.tally?.main||0}/5 · Otros premios: ${state.tally?.other||0}/5</p>`:''}<div class="actions" id="actions"></div><p id="error" class="error"></p></div>${state.phase==='setup'?`<div class="card"><h2>Llaves entregadas</h2><p>Tocá los números que participan. Necesitás al menos 10.</p><div class="actions"><button id="all">Todas</button><button id="none" class="secondary">Ninguna</button></div><div class="numbers">${Array.from({length:130},(_,i)=>`<button data-number="${i+1}" class="${selected.has(i+1)?'on':''}">${i+1}</button>`).join('')}</div><p id="count">${selected.size} habilitadas</p><button id="save">Guardar selección</button></div>`:''}<div class="card"><h2>Llaves elegidas: ${state.finalists.length}/10</h2><div class="actions">${state.finalists.map(n=>`<button data-finalist="${n}" ${state.phase!=='final'||state.active!==null||state.completed.includes(n)?'disabled':''}>${n}${state.completed.includes(n)?' ✓':''}</button>`).join('')}</div><p>${state.phase==='draw'?'Estas llaves ya están confirmadas para participar en la final.':'Durante la final, tocá el número de quien se acerque. Cada llave tiene un único intento.'}</p></div><div class="card"><h2>Presentación y sonido</h2><p id="audio-remote-status">${esc(remoteAudioStatus()||'')}</p><div class="actions"><button id="audio">${presentation?.sound?'Desactivar sonido':'Activar sonido'}</button><button id="audio-test" ${!presentation?.sound||!presentation?.volume?'disabled':''}>Probar sonido en la pantalla</button><button id="motion">${presentation?.reduceMotion?'Animar apertura':'Reducir movimiento'}</button></div><label for="audio-volume">Volumen: <b id="audio-level">${Math.round((presentation?.volume??.85)*100)}%</b></label><input id="audio-volume" type="range" min="0" max="100" value="${Math.round((presentation?.volume??.85)*100)}"><p>El primer clic para habilitar audio y pantalla completa se hace en la computadora. Estos controles no reproducen sonido en el celular.</p></div><div class="card"><h2>Registro de premios</h2>${state.history.filter(x=>x.event==='premio').map(x=>`<p>Llave ${x.number}: ${x.opens?esc(x.prize):'Premio · no abrió'}</p>`).join('')||'<p>Todavía no se realizaron intentos.</p>'}</div><details class="card"><summary>Administración</summary><p>Los ausentes quedan excluidos de los siguientes sorteos. Los resultados se guardan automáticamente en el servidor.</p><p>Ausentes: ${state.absent.join(', ')||'Ninguno'}</p><button id="reset" class="danger">Reiniciar partida</button><button id="logout" class="secondary">Desconectar control</button></details></div>`;
 document.querySelector('#audio').onclick=()=>savePresentation({sound:!presentation.sound});document.querySelector('#audio-test').onclick=()=>savePresentation({test:true});document.querySelector('#motion').onclick=()=>savePresentation({reduceMotion:!presentation.reduceMotion});document.querySelector('#audio-volume').oninput=e=>{document.querySelector('#audio-level').textContent=e.target.value+'%';};document.querySelector('#audio-volume').onchange=e=>savePresentation({volume:Number(e.target.value)/100});
 const actions=document.querySelector('#actions');const add=(label,action,data={},disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>send(action,data);actions.append(b);};
 if(state.phase==='setup')add('Comenzar sorteo','begin',{},state.enabled.length<10||editing);if(state.phase==='draw'){if(state.spinning)add('DETENER Y REVELAR','stop');else if(state.pending){add('Está presente: confirmar','confirm');add('Ausente: excluir y repetir','absent');}else if(state.finalists.length===10)add('Preparar final','final');else add('Iniciar selección','spin');}if(state.phase==='final'&&state.active!==null){if(state.revealed)add(state.revealed.presented?'Premio entregado: continuar':'Esperando que termine la presentación…','next',{},!state.revealed.presented);else add('Probar llave '+state.active,'reveal');}
 document.querySelectorAll('[data-finalist]').forEach(b=>b.onclick=()=>send('select',{number:Number(b.dataset.finalist)}));document.querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>{editing=true;const n=Number(b.dataset.number);selected.has(n)?selected.delete(n):selected.add(n);b.classList.toggle('on',selected.has(n));document.querySelector('#count').textContent=selected.size+' habilitadas · cambios sin guardar';actions.querySelector('button').disabled=true;});if(state.phase==='setup'){document.querySelector('#all').onclick=()=>{editing=true;selected=new Set(Array.from({length:130},(_,i)=>i+1));renderControl();};document.querySelector('#none').onclick=()=>{editing=true;selected.clear();renderControl();};document.querySelector('#save').onclick=()=>send('enable',{numbers:[...selected]});}document.querySelector('#reset').onclick=confirmReset;document.querySelector('#logout').onclick=async()=>{await fetch('/api/logout',{method:'POST'});pin='';authenticated=false;render();};}
fetch('/api/session').then(r=>r.json()).then(s=>{authenticated=s.authenticated;render();}).catch(()=>{});
// Short requests work through shared-hosting proxies without relying on SSE buffering.
async function sync(){
 try{
  const r=await fetch('/api/state',{cache:'no-store'});
  if(!r.ok)throw Error('Sin conexión');
  const next=await r.json();
  if(next.version!==VERSION||!next.presentation){if(!state)app.innerHTML='<main class="panel"><h1>Actualización incompleta</h1><p>Reemplazá todos los archivos de la nueva versión y reiniciá la aplicación desde cPanel.</p></main>';throw Error('Falta actualizar el servidor a la versión '+VERSION);}
  const warning=document.querySelector('.connection-warning');if(warning)warning.hidden=true;applyPresentation(next.presentation);
  if(!state||next.revision>state.revision){state=next;render();}
  const el=document.querySelector('#connection');
  if(el)el.textContent=`Conectado`;
 }catch(error){
  const warning=document.querySelector('.connection-warning');if(warning){warning.hidden=false;warning.textContent=error.message;}
  const el=document.querySelector('#connection');
  if(el)el.textContent='Conexión interrumpida · Reconectando…';
 }finally{setTimeout(sync,750);}
}
sync();
