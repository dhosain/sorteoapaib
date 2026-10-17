import {mkdirSync,readFileSync,openSync,writeFileSync,closeSync,fsyncSync,renameSync,unlinkSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fresh} from './game.mjs';
export const STORAGE_VERSION=2;
export function createStore(dir,{filename='game.json',initial=fresh}={}){
 mkdirSync(dir,{recursive:true,mode:0o700});
 const file=dir+'/'+filename,lock=dir+(filename==='game.json'?'/.game-lock':'/.'+filename+'-lock');
 function read(){try{return JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return initial();throw e;}}
 function acquire(){
  try{return openSync(lock,'wx',0o600);}catch(e){
   if(e.code!=='EEXIST')throw e;
   // A crashed worker may leave a lock. Never steal a live worker's lock.
   try{const owner=Number(readFileSync(lock,'utf8'));if(Date.now()-statSync(lock).mtimeMs>5000&&owner>0){try{process.kill(owner,0);}catch(x){if(x.code==='ESRCH'){unlinkSync(lock);return openSync(lock,'wx',0o600);}}}}catch{}
   throw Error('Otra operación está en curso. Esperá un momento e intentá nuevamente.');
  }
 }
 function change(update){
  const fd=acquire();
  try{
   writeFileSync(fd,String(process.pid));
   const current=read(),next=update(current);
   if(next===current)return next;
   const temporary=file+'.'+process.pid+'.'+randomUUID()+'.tmp';
   const output=openSync(temporary,'wx',0o600);
   try{writeFileSync(output,JSON.stringify(next));fsyncSync(output);}finally{closeSync(output);}
   renameSync(temporary,file);return next;
  }finally{closeSync(fd);unlinkSync(lock);}
 }
 return {read,change};
}
