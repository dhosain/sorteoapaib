const app=document.querySelector('#app'),control=location.pathname==='/control';let state,pin='',authenticated=false,audioContext,sound=false,selected=new Set(),editing=false,lastReveal='',timer,highlight;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tone(freq=440,duration=.15){if(!sound)return;audioContext||=new AudioContext();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.08,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);}
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
function prizeMessage(r){
 if(r.rank===1)return '¡Ganaste un TV de 55 pulgadas!';
 if(r.rank===2)return '¡Ganaste un robot aspiradora!';
 if(r.rank===3)return '¡Ganaste un parlante!';
 return '¡Ganaste un smartwatch!';
}
function prizeArtwork(r){
 const drawing=r.rank===1?'<rect x="12" y="25" width="156" height="96" rx="6" fill="#101b29"/><rect x="19" y="32" width="142" height="82" rx="2" fill="url(#prize-glow)"/><path d="M60 133h60M90 122v11" stroke="#dbe3e7" stroke-width="6"/><text x="90" y="85" text-anchor="middle" fill="white" font-size="30">55″</text>':r.rank===2?'<ellipse cx="90" cy="111" rx="68" ry="19" fill="#0005"/><ellipse cx="90" cy="84" rx="66" ry="44" fill="#d5dde0"/><ellipse cx="90" cy="77" rx="66" ry="44" fill="#f0f4f5"/><circle cx="90" cy="65" r="17" fill="#556777"/><circle cx="90" cy="65" r="11" fill="#9caebb"/><path d="M51 94h78" stroke="#7b8c99" stroke-width="3"/>':r.rank===3?'<rect x="49" y="15" width="82" height="126" rx="15" fill="#243443"/><circle cx="90" cy="50" r="19" fill="#0d1923" stroke="#8196a0" stroke-width="3"/><circle cx="90" cy="103" r="26" fill="#101d28" stroke="#8196a0" stroke-width="3"/><circle cx="90" cy="103" r="11" fill="#456270"/>':'<rect x="69" y="1" width="42" height="154" rx="12" fill="#254b46"/><rect x="48" y="38" width="84" height="82" rx="21" fill="#a9b9be"/><rect x="54" y="44" width="72" height="70" rx="16" fill="#10232b"/><path d="M90 56v24l18 9" fill="none" stroke="#dfbc71" stroke-width="5"/><circle cx="90" cy="80" r="3" fill="#dfbc71"/>';
 return `<svg class="prize-art" viewBox="0 0 180 156" aria-label="${esc(r.prize)}" role="img"><defs><linearGradient id="prize-glow"><stop stop-color="#2788ae"/><stop offset="1" stop-color="#853c91"/></linearGradient></defs>${drawing}</svg>`;
}

function message(){if(state.phase==='setup')return 'La puerta de los premios está por abrir su historia';if(state.spinning)return '¿Qué llave será la elegida?';if(state.pending)return `Llave <strong>${state.pending}</strong> · ¡Acercate para confirmar!`;if(state.phase==='draw')return state.finalists.length===10?'¡Ya tenemos los 10 finalistas!':`Turno ${Math.min(5,Math.floor(state.finalists.length/2)+1)} de 5 · ${state.finalists.length%2===0?'Primera':'Segunda'} plaza`;if(state.phase==='done')return '¡Gracias por celebrar los 97 años de APAIB!';if(state.revealed)return control?(state.revealed.opens?prizeMessage(state.revealed):'¡También tenés un premio consuelo!'):'Probando la llave…';if(state.active)return `Llave <strong>${state.active}</strong> · ¿Abrirá la puerta?`;return 'Final · Que se acerque quien quiera intentar';}
function render(){if(!state)return;if(control){renderControl();return;}app.innerHTML=`<main class="stage"><header><img class="brand-logo" src="/assets/logo.png" alt="Logo de APAIB"><small>ASOCIACIÓN CULTURAL ISLÁMICA</small><h1>APAIB · 97 aniversario</h1><div>Una llave. Una historia. Una sorpresa.</div></header><div class="scene"><div class="keys">${keys(1,65)}</div><div class="doorframe"><div class="inside" id="prize"></div><div class="leaves"><div class="leaf"></div><div class="leaf"></div></div></div><div class="keys">${keys(66,130)}</div></div><div class="banner" id="banner">${message()}<div class="summary">${state.finalists.map(n=>`<span>${n}${state.completed.includes(n)?' ✓':''}</span>`).join('')}</div>${state.phase==='done'?`<div class="summary">${state.history.filter(x=>x.event==='premio').map(x=>`<span>${x.number}: ${esc(x.prize)}</span>`).join('')}</div>`:''}</div><div class="toolbar"><button id="audio">${sound?'Sonido activado':'Activar sonido'}</button><button id="fullscreen">Pantalla completa</button><button id="controls">Controles</button></div></main>`;
 document.querySelector('#audio').onclick=()=>{sound=!sound;tone();document.querySelector('#audio').textContent=sound?'Sonido activado':'Activar sonido';};document.querySelector('#fullscreen').onclick=()=>document.documentElement.requestFullscreen();document.querySelector('#controls').onclick=()=>window.open('/control','apaib-control');

 clearInterval(timer);if(state.spinning)timer=setInterval(()=>{const pool=state.enabled.filter(n=>!state.finalists.includes(n)&&!state.absent.includes(n));document.querySelector('.glow')?.classList.remove('glow');highlight=pool[Math.floor(Math.random()*pool.length)];document.querySelector(`[data-key="${highlight}"]`)?.classList.add('glow');tone(300+Math.random()*500,.07);},125);
 if(state.revealed){const signature=state.revealed.number+':'+state.revision;if(signature!==lastReveal){lastReveal=signature;reveal(state.revealed,true);}else reveal(state.revealed,false);}}
function keys(a,b){return Array.from({length:b-a+1},(_,i)=>{const n=a+i;return `<div data-key="${n}" class="key ${!state.enabled.includes(n)||state.absent.includes(n)?'disabled':''} ${state.finalists.includes(n)?'chosen':''} ${state.pending===n?'glow':''}"><svg class="key-icon" viewBox="0 0 28 14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7h14m-4 0v4m-5-4v3" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>${n}</span></div>`;}).join('');}
function reveal(r,animate){
 const stage=document.querySelector('.stage'),prize=stage.querySelector('#prize'),banner=stage.querySelector('#banner');
 const tier=r.rank===1?'tv':r.rank===2?'robot':r.rank===3?'speaker':'watch';
 if(r.opens)prize.innerHTML=`${prizeArtwork(r)}<span class="prize-label">${esc(r.prize)}</span>`;
 const announce=()=>{
  if(!stage.isConnected)return;
  banner.classList.add('result-banner');
  if(r.opens){banner.classList.add('winner',`prize-${tier}`);banner.innerHTML=`<strong>${prizeMessage(r)}</strong><span class="winner-number">Llave ${r.number} · ${r.rank}º premio</span>`;}
  else banner.innerHTML='Esta vez tu llave no abrió…<br><strong>¡Pero también tenés un premio!</strong><br>Llave '+r.number+' · Premio consuelo';
  if(animate){
   [r.opens?523:220,r.opens?659:196,r.opens?784:174].forEach((f,i)=>setTimeout(()=>{if(stage.isConnected)tone(f,.6);},i*200));
   if(r.opens){const count=r.rank===1?150:r.rank===2?110:r.rank===3?80:55;
    for(let i=0;i<count;i++){const p=document.createElement('i');p.className='particle';p.style.left=Math.random()*100+'%';p.style.background=['#f1cf71','#fff','#168154','#7dbeec'][i%4];p.style.animationDelay=Math.random()+'s';stage.append(p);setTimeout(()=>p.remove(),4500);}
   }
  }
 };
 const open=()=>{
  if(!stage.isConnected)return;
  stage.classList.remove('trying');
  if(r.opens){
   // Paint the closed doors before changing their transforms. Keep the
   // leaves visible below 90 degrees, rotating inward around their hinges.
   stage.classList.add('open');
   banner.innerHTML='La puerta se está abriendo…';
   if(animate)setTimeout(announce,3400);else announce();
  }else announce();
 };
 if(animate){stage.classList.add('trying');tone(180,1);setTimeout(open,1700);}
 else{stage.classList.add('settled');open();}
}

function renderControl(){if(!authenticated){app.innerHTML=`<div class="panel"><h1>APAIB · Control</h1><p>Ingresá el código privado de control del evento.</p><input id="pin" type="password" autocomplete="current-password" placeholder="Código de control"><button id="login">Conectar</button><p id="error" class="error"></p></div>`;document.querySelector('#login').onclick=async()=>{pin=document.querySelector('#pin').value;await send('login');};return;}if(!editing)selected=new Set(state.enabled);
 app.innerHTML=`<div class="panel"><h1>APAIB · Control</h1><p class="status" id="connection">Conectado · ${state.finalists.length}/10 finalistas · ${state.completed.length}/10 intentos</p><div class="card"><p>${message()}</p><div class="actions" id="actions"></div><p id="error" class="error"></p></div>${state.phase==='setup'?`<div class="card"><h2>Llaves entregadas</h2><p>Tocá los números que participan. Necesitás al menos 10.</p><div class="actions"><button id="all">Todas</button><button id="none" class="secondary">Ninguna</button></div><div class="numbers">${Array.from({length:130},(_,i)=>`<button data-number="${i+1}" class="${selected.has(i+1)?'on':''}">${i+1}</button>`).join('')}</div><p id="count">${selected.size} habilitadas</p><button id="save">Guardar selección</button></div>`:''}<div class="card"><h2>Finalistas</h2><div class="actions">${state.finalists.map(n=>`<button data-finalist="${n}" ${state.phase!=='final'||state.active!==null||state.completed.includes(n)?'disabled':''}>${n}${state.completed.includes(n)?' ✓':''}</button>`).join('')}</div><p>Durante la final, tocá el número de quien se acerque. Cada llave tiene un único intento.</p></div><details class="card"><summary>Administración</summary><p>Los ausentes quedan excluidos de los siguientes sorteos. Los resultados se guardan automáticamente en el servidor.</p><p>Ausentes: ${state.absent.join(', ')||'Ninguno'}</p><button id="reset" class="danger">Reiniciar partida</button><button id="logout" class="secondary">Desconectar control</button></details></div>`;
 const actions=document.querySelector('#actions');const add=(label,action,data={},disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>send(action,data);actions.append(b);};
 if(state.phase==='setup')add('Comenzar sorteo','begin',{},state.enabled.length<10||editing);if(state.phase==='draw'){if(state.spinning)add('DETENER Y REVELAR','stop');else if(state.pending){add('Está presente: confirmar','confirm');add('Ausente: excluir y repetir','absent');}else if(state.finalists.length===10)add('Preparar final','final');else add('Iniciar selección','spin');}if(state.phase==='final'&&state.active!==null){if(state.revealed)add('Premio entregado: continuar','next');else add('Probar llave '+state.active,'reveal');}
 document.querySelectorAll('[data-finalist]').forEach(b=>b.onclick=()=>send('select',{number:Number(b.dataset.finalist)}));document.querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>{editing=true;const n=Number(b.dataset.number);selected.has(n)?selected.delete(n):selected.add(n);b.classList.toggle('on',selected.has(n));document.querySelector('#count').textContent=selected.size+' habilitadas · cambios sin guardar';actions.querySelector('button').disabled=true;});if(state.phase==='setup'){document.querySelector('#all').onclick=()=>{editing=true;selected=new Set(Array.from({length:130},(_,i)=>i+1));renderControl();};document.querySelector('#none').onclick=()=>{editing=true;selected.clear();renderControl();};document.querySelector('#save').onclick=()=>send('enable',{numbers:[...selected]});}document.querySelector('#reset').onclick=confirmReset;document.querySelector('#logout').onclick=async()=>{await fetch('/api/logout',{method:'POST'});pin='';authenticated=false;render();};}
fetch('/api/session').then(r=>r.json()).then(s=>{authenticated=s.authenticated;render();}).catch(()=>{});
// Short requests work through shared-hosting proxies without relying on SSE buffering.
async function sync(){
 try{
  const r=await fetch('/api/state',{cache:'no-store'});
  if(!r.ok)throw Error('Sin conexión');
  const next=await r.json();
  if(!state||next.revision>state.revision){state=next;render();}
  const el=document.querySelector('#connection');
  if(el)el.textContent=`Conectado · ${state.finalists.length}/10 finalistas · ${state.completed.length}/10 intentos`;
 }catch{
  const el=document.querySelector('#connection');
  if(el)el.textContent='Conexión interrumpida · Reconectando…';
 }finally{setTimeout(sync,750);}
}
sync();
