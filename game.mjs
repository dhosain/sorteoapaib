import {randomInt} from 'node:crypto';
export const prizes=['TV 55 pulgadas','Robot aspiradora','Parlante','Smart watch','Smart watch'];
export function fresh(){return {enabled:[],absent:[],finalists:[],pending:null,phase:'setup',spinning:false,assignment:null,active:null,revealed:null,completed:[],history:[],revision:0};}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function transition(s,action,data={}){
 s=structuredClone(s);
 const require=(ok,msg)=>{if(!ok)throw Error(msg)};
 switch(action){
 case 'enable':require(s.phase==='setup','La partida ya comenzó');require(Array.isArray(data.numbers)&&data.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=130),'Números inválidos');s.enabled=[...new Set(data.numbers)].sort((a,b)=>a-b);break;
 case 'begin':require(s.phase==='setup'&&s.enabled.length>=10,'Habilitá al menos 10 llaves');s.phase='draw';break;
 case 'spin':require(s.phase==='draw'&&!s.spinning&&!s.pending&&s.finalists.length<10,'No se puede iniciar');require(s.enabled.some(n=>!s.absent.includes(n)&&!s.finalists.includes(n)),'No quedan llaves disponibles');s.spinning=true;break;
 case 'stop':require(s.spinning,'El sorteo no está en marcha');{const pool=s.enabled.filter(n=>!s.absent.includes(n)&&!s.finalists.includes(n));s.pending=pool[randomInt(pool.length)];s.spinning=false;}break;
 case 'confirm':require(s.pending!==null,'No hay resultado pendiente');s.finalists.push(s.pending);s.history.push({event:'finalista',number:s.pending});s.pending=null;break;
 case 'absent':require(s.pending!==null,'No hay resultado pendiente');s.absent.push(s.pending);s.history.push({event:'ausente',number:s.pending});s.pending=null;break;
 case 'final':require(s.phase==='draw'&&s.finalists.length===10,'Faltan finalistas');{const outcomes=shuffle([...prizes.map((prize,i)=>({opens:true,prize,rank:i+1})),...Array.from({length:5},()=>({opens:false,prize:'Premio consuelo'}))]);s.assignment=Object.fromEntries(s.finalists.map((n,i)=>[n,outcomes[i]]));s.phase='final';}break;
 case 'select':require(s.phase==='final'&&s.active===null&&s.finalists.includes(data.number)&&!s.completed.includes(data.number),'Elegí un finalista pendiente');s.active=data.number;break;
 case 'reveal':require(s.phase==='final'&&s.active!==null&&s.revealed===null,'No hay intento pendiente');s.revealed={number:s.active,...s.assignment[s.active]};s.history.push({event:'premio',...s.revealed});break;
 case 'next':require(s.revealed!==null,'Primero revelá el resultado');s.completed.push(s.active);s.active=null;s.revealed=null;if(s.completed.length===10)s.phase='done';break;
 default:throw Error('Acción desconocida');
 }s.revision++;return s;
}
export function publicState(s){const {assignment,...view}=s;return view;}
