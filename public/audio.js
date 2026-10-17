// One shared audio graph. Effects recover a suspended context after the first
// user activation; blocked recovery is visible rather than silently ignored.
export function createAudio({enabled=true,volume=.85,onStatus=()=>{},contextFactory=()=>new AudioContext()}={}){
 let context,master,compressor,resuming,epoch=0,tick=0;
 const voices=new Set();
 volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:.85));
 function status(){return !enabled?'muted':volume===0?'silent':context?.state==='running'?'ready':context?'blocked':'locked';}
 function notify(){onStatus(status());}
 function create(){
  if(context&&context.state!=='closed')return;
  context=contextFactory();master=context.createGain();master.gain.value=enabled?volume:0;
  compressor=context.createDynamicsCompressor();compressor.threshold.value=-9;compressor.knee.value=6;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
  master.connect(compressor);compressor.connect(context.destination);context.addEventListener('statechange',notify);
 }
 async function ready(activate=false){
  if(!enabled&&!activate)return false;
  if(activate){try{create();}catch{notify();return false;}}
  if(!context){notify();return false;}
  if(context.state==='running')return true;
  if(!resuming){
   resuming=(async()=>{let timeout;try{await Promise.race([context.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('activation required')),900);})]);}catch{}finally{clearTimeout(timeout);resuming=null;notify();}})();
  }
  await resuming;return enabled&&context.state==='running';
 }
 function stop(){epoch++;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 function setEnabled(next){enabled=next;if(!enabled)stop();if(master)master.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.015);notify();}
 function setVolume(next){volume=Math.max(0,Math.min(1,next));if(master)master.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.015);notify();}
 function note(frequency,start,duration,{brass=false,peak=.26}={}){
  const oscillator=context.createOscillator(),gain=context.createGain();let filter;
  oscillator.frequency.value=frequency;oscillator.type=brass?'sawtooth':'triangle';
  gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(peak,start+(brass ? .04 : .008));gain.gain.setValueAtTime(peak*.8,start+duration*.65);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
  if(brass){filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;oscillator.connect(filter);filter.connect(gain);}else oscillator.connect(gain);
  gain.connect(master);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();filter?.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+duration);
 }
 async function tone(frequency=440,duration=.15){
  const request=++tick,generation=epoch,deadline=performance.now()+220;
  if(!await ready()||request!==tick||generation!==epoch||performance.now()>deadline)return false;
  try{note(frequency,context.currentTime+.012,duration);return true;}catch{notify();return false;}
 }
 async function fanfare(){
  const generation=epoch,deadline=performance.now()+1200;tick++;
  if(!await ready()||generation!==epoch||performance.now()>deadline)return false;
  const now=context.currentTime+.025;
  try{for(const [frequency,offset,duration] of [[523,0,.22],[523,.26,.22],[659,.52,.3],[784,.86,.32],[1047,1.22,1.4],[659,1.22,1.4],[784,1.22,1.4]])note(frequency,now+offset,duration,{brass:true,peak:.22});return true;}catch{notify();return false;}
 }
 return {unlock:()=>ready(true),recover:()=>ready(false),tone,fanfare,setEnabled,setVolume,status,get volume(){return volume;},get context(){return context;}};
}
