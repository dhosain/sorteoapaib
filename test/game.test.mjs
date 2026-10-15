import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,transition,publicState,prizes,validate} from '../game.mjs';
function finalists(){let s=transition(fresh(),'enable',{numbers:Array.from({length:130},(_,i)=>i+1)});s=transition(s,'begin');for(let i=0;i<10;i++){s=transition(s,'spin');s=transition(s,'stop');s=transition(s,'confirm');}return s;}
test('Solo se eligen habilitados, sin repetir; ausentes quedan excluidos',()=>{let s=transition(fresh(),'enable',{numbers:Array.from({length:12},(_,i)=>i+1)});s=transition(s,'begin');s=transition(s,'spin');s=transition(s,'stop');const absent=s.pending;s=transition(s,'absent');for(let i=0;i<10;i++){s=transition(s,'spin');s=transition(s,'stop');assert.notEqual(s.pending,absent);assert.ok(s.enabled.includes(s.pending));s=transition(s,'confirm');}assert.equal(new Set(s.finalists).size,10);assert.throws(()=>transition(s,'spin'));});
test('Exactamente cinco aperturas y los cinco premios, en cualquier orden',()=>{for(let round=0;round<500;round++){let s=transition(finalists(),'final');assert.equal(publicState(s).assignment,undefined);const order=[...s.finalists].reverse();const outcomes=[];for(const n of order){s=transition(s,'select',{number:n});s=transition(s,'reveal');const before=structuredClone(s.revealed);s=JSON.parse(JSON.stringify(s));assert.deepEqual(s.revealed,before);outcomes.push(s.revealed);assert.throws(()=>transition(s,'reveal'));assert.throws(()=>transition(s,'next'),/pantalla principal/);s=transition(s,'presented',{presentationId:s.revealed.presentationId});s=transition(s,'next');}assert.equal(outcomes.filter(x=>x.opens).length,5);assert.deepEqual(outcomes.filter(x=>x.opens).map(x=>x.prize).sort(),[...prizes].sort());assert.equal(s.phase,'done');assert.throws(()=>transition(s,'select',{number:order[0]}));}});
test('Las transiciones inválidas no modifican la partida',()=>{const s=fresh();assert.throws(()=>transition(s,'begin'));assert.throws(()=>transition(s,'enable',{numbers:[0,131]}));assert.throws(()=>transition(s,'reveal'));assert.deepEqual(s,fresh());});

test('Rechaza asignaciones faltantes, conteos corruptos y catálogos viejos sin inventar resultados',()=>{
 const s=transition(finalists(),'final');
 const missing=structuredClone(s);delete missing.assignment[missing.finalists[0]];
 assert.equal(publicState(missing).integrity.valid,false);assert.throws(()=>transition(missing,'select',{number:missing.finalists[0]}),/asignación/);
 const four=structuredClone(s);const winner=four.finalists.find(n=>four.assignment[n].opens);four.assignment[winner]={opens:false,prize:'Premio'};
 assert.throws(()=>validate(four),/cinco aperturas/);
 const legacy=structuredClone(s);delete legacy.schemaVersion;assert.throws(()=>transition(legacy,'select',{number:legacy.finalists[0]}),/versión anterior/);
 assert.deepEqual(prizes,['Smart TV de 55 pulgadas','Smart TV de 40 pulgadas','Aspiradora Robot','Parlante Bluetooth','Smart Watch']);
});
test('Una confirmación de pantalla antigua no habilita el intento siguiente',()=>{
 let s=transition(finalists(),'final');s=transition(s,'select',{number:s.finalists[0]});s=transition(s,'reveal');
 assert.throws(()=>transition(s,'presented',{presentationId:'otro-intento'}));
 s=transition(s,'presented',{presentationId:s.revealed.presentationId});s=transition(s,'next');
 s=transition(s,'select',{number:s.finalists[1]});s=transition(s,'reveal');assert.equal(s.revealed.presented,false);
 assert.throws(()=>transition(s,'next'),/pantalla principal/);
});
