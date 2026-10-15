import {randomInt,randomUUID} from 'node:crypto';
import {PRIZES} from './public/config.js';
export const prizes=PRIZES.map(p=>p.name);
export function fresh(){return {schemaVersion:2,enabled:[],absent:[],finalists:[],pending:null,phase:'setup',spinning:false,assignment:null,active:null,revealed:null,completed:[],history:[],revision:0};}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validate(s){
 const require=(ok,msg)=>{if(!ok)throw Error(msg)};
 const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
 require(unique(s.finalists)&&s.finalists.length<=10&&s.finalists.every(n=>s.enabled.includes(n)),'La lista de finalistas es inconsistente');
 require(unique(s.completed)&&s.completed.every(n=>s.finalists.includes(n)),'Los intentos guardados son inconsistentes');
 if(s.assignment===null){require(!['final','done'].includes(s.phase),'Falta la asignación de premios');require(s.completed.length===0&&s.active===null&&s.revealed===null&&!s.history.some(x=>x.event==='premio'),'Hay resultados sin asignación de premios');return;}
 require(s.schemaVersion===2,'Esta partida usa los premios de la versión anterior. Guardá un respaldo y reiniciá la partida desde Administración.');
 require(s.finalists.length===10&&Object.keys(s.assignment).length===10&&s.finalists.every(n=>Object.hasOwn(s.assignment,n)),'Falta la asignación de alguna llave. No se realizará otro intento.');
 const outcomes=Object.values(s.assignment),winners=outcomes.filter(x=>x?.opens===true);
 require(winners.length===5&&outcomes.filter(x=>x?.opens===false).length===5,'La asignación no tiene exactamente cinco aperturas y cinco llaves sin apertura');
 require(outcomes.filter(x=>!x.opens).every(x=>x.prize==='Premio'&&x.rank===undefined),'Las llaves sin apertura tienen resultados inconsistentes');
 require(s.active===null||(s.finalists.includes(s.active)&&!s.completed.includes(s.active)),'La llave activa es inconsistente');
 require(new Set(winners.map(x=>x.rank)).size===5&&winners.every(x=>PRIZES.some(p=>p.rank===x.rank&&p.name===x.prize)),'Los cinco premios no coinciden con el catálogo');
 const awards=s.history.filter(x=>x.event==='premio');
 require(awards.length===s.completed.length+(s.revealed?1:0),'El número de resultados no coincide con los intentos realizados');
 require(unique(awards.map(x=>x.number))&&awards.every(x=>{const a=s.assignment[x.number];return a&&x.opens===a.opens&&x.prize===a.prize&&x.rank===a.rank;}),'El registro de premios no coincide con las llaves asignadas');
 require(s.completed.every(n=>awards.some(x=>x.number===n)),'Hay intentos completados sin premio registrado');
 if(s.revealed){const a=s.assignment[s.active];require(a&&s.revealed.number===s.active&&s.revealed.opens===a.opens&&s.revealed.prize===a.prize&&s.revealed.rank===a.rank,'El intento actual no coincide con su premio');}
 if(s.phase==='done')require(s.completed.length===10&&awards.length===10&&awards.filter(x=>x.opens).length===5,'La partida no termina con diez resultados y cinco premios principales');
}
export function transition(s,action,data={}){
 s=structuredClone(s);validate(s);
 const require=(ok,msg)=>{if(!ok)throw Error(msg)};
 switch(action){
 case 'enable':require(s.phase==='setup','La partida ya comenzó');require(Array.isArray(data.numbers)&&data.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=130),'Números inválidos');s.enabled=[...new Set(data.numbers)].sort((a,b)=>a-b);break;
 case 'begin':require(s.phase==='setup'&&s.enabled.length>=10,'Habilitá al menos 10 llaves');s.phase='draw';break;
 case 'spin':require(s.phase==='draw'&&!s.spinning&&!s.pending&&s.finalists.length<10,'No se puede iniciar');require(s.enabled.some(n=>!s.absent.includes(n)&&!s.finalists.includes(n)),'No quedan llaves disponibles');s.spinning=true;break;
 case 'stop':require(s.spinning,'El sorteo no está en marcha');{const pool=s.enabled.filter(n=>!s.absent.includes(n)&&!s.finalists.includes(n));s.pending=pool[randomInt(pool.length)];s.spinning=false;}break;
 case 'confirm':require(s.pending!==null,'No hay resultado pendiente');s.finalists.push(s.pending);s.history.push({event:'finalista',number:s.pending});s.pending=null;break;
 case 'absent':require(s.pending!==null,'No hay resultado pendiente');s.absent.push(s.pending);s.history.push({event:'ausente',number:s.pending});s.pending=null;break;
 case 'final':require(s.phase==='draw'&&s.finalists.length===10,'Faltan finalistas');{const outcomes=shuffle([...PRIZES.map(p=>({opens:true,prize:p.name,rank:p.rank})),...Array.from({length:5},()=>({opens:false,prize:'Premio'}))]);s.schemaVersion=2;s.assignment=Object.fromEntries(s.finalists.map((n,i)=>[n,outcomes[i]]));s.phase='final';}break;
 case 'select':require(s.phase==='final'&&s.active===null&&s.finalists.includes(data.number)&&!s.completed.includes(data.number),'Elegí un finalista pendiente');s.active=data.number;break;
 case 'reveal':require(s.phase==='final'&&s.active!==null&&s.revealed===null,'No hay intento pendiente');require(s.assignment[s.active]!==undefined,'Esta llave no tiene un premio asignado');s.revealed={number:s.active,...s.assignment[s.active],presentationId:randomUUID(),presented:false};s.history.push({event:'premio',...s.revealed});break;
 case 'presented':require(s.revealed&&s.revealed.presentationId===data.presentationId,'El resultado ya cambió');require(!s.revealed.presented,'El resultado ya fue mostrado');s.revealed.presented=true;break;
 case 'next':require(s.revealed?.presented===true,'Esperá a que la pantalla principal termine de mostrar el resultado');s.completed.push(s.active);s.active=null;s.revealed=null;if(s.completed.length===10)s.phase='done';break;
 default:throw Error('Acción desconocida');
 }validate(s);s.revision++;return s;
}
export function publicState(s){const {assignment,...view}=s;let integrity={valid:true,message:''};try{validate(s);}catch(e){integrity={valid:false,message:e.message};}const awards=s.history.filter(x=>x.event==='premio');return {...view,integrity,tally:{attempts:awards.length,main:awards.filter(x=>x.opens===true).length,other:awards.filter(x=>x.opens===false).length}};}
