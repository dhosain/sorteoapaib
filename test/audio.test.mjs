import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../public/audio.js';
function context(){
 const parameter=()=>({value:0,setTargetAtTime(){}});
 return {state:'suspended',currentTime:0,destination:{},oscillators:0,
  createGain(){return {gain:parameter(),connect(){}};},
  createDynamicsCompressor(){return {threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),connect(){}};},
  addEventListener(){},resume(){this.state='running';return Promise.resolve();},
  createOscillator(){this.oscillators++;throw Error('A delayed muted effect must not create an oscillator');}
 };
}
test('El bloqueo del navegador se informa y permite reintentar sin crear otro contexto',async()=>{
 const ctx=context();let creations=0;ctx.resume=()=>Promise.reject(Error('gesture required'));
 const audio=createAudio({contextFactory:()=>{creations++;return ctx;}});
 assert.equal(await audio.unlock(),false);assert.equal(audio.status(),'blocked');
 ctx.resume=()=>{ctx.state='running';return Promise.resolve();};
 assert.equal(await audio.unlock(),true);assert.equal(audio.status(),'ready');assert.equal(creations,1);
 audio.setVolume(0);assert.equal(audio.status(),'silent');audio.setVolume(.6);assert.equal(audio.volume,.6);
});
test('Silenciar durante la recuperación cancela la fanfarria pendiente',async()=>{
 const ctx=context(),audio=createAudio({contextFactory:()=>ctx});await audio.unlock();ctx.state='suspended';
 let resume;ctx.resume=()=>new Promise(resolve=>{resume=()=>{ctx.state='running';resolve();};});
 const pending=audio.fanfare();audio.setEnabled(false);resume();
 assert.equal(await pending,false);assert.equal(ctx.oscillators,0);assert.equal(audio.status(),'muted');
});
