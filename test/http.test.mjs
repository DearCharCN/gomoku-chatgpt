import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('HTTP 集成：会话、CSRF、回合、持久化、复盘与未登录错误',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gomoku-test-')),port=33219,origin=`http://127.0.0.1:${port}`;
 await writeFile(join(dir,'games.json'),JSON.stringify([{id:'fixture',humanColor:1,model:'test',moves:[],status:'playing',createdAt:new Date().toISOString()}]));
 const p=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),GOMOKU_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});p.stderr.resume();
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server timeout')),10000);p.stdout.on('data',()=>{clearTimeout(timer);resolve();});p.on('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'));});});
  const page=await fetch(origin);assert.equal(page.status,200);const cookie=page.headers.get('set-cookie').split(';')[0];
  const noSession=await fetch(origin+'/api/state');assert.equal(noSession.status,401);
  const state=await fetch(origin+'/api/state',{headers:{Cookie:cookie}}).then(r=>r.json());assert.equal(state.games.length,1);
  const post=(path,data,csrf=true)=>fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':state.csrf}:{})},body:JSON.stringify(data)});
  assert.equal((await post('games/move',{id:'fixture',x:7,y:7},false)).status,403);
  const move=await post('games/move',{id:'fixture',x:7,y:7});assert.equal(move.status,200);assert.equal((await move.json()).game.moves.length,1);
  assert.equal((await post('games/move',{id:'fixture',x:8,y:8})).status,400);
  const ai=await post('games/ai',{id:'fixture'});assert.match((await ai.json()).error,/连接 ChatGPT/);
  assert.equal((await post('games/review',{id:'fixture'})).status,400);
  const resign=await post('games/resign',{id:'fixture'});assert.equal((await resign.json()).game.status,'finished');
  assert.equal((await post('games/move',{id:'fixture',x:3,y:3})).status,400);
  const login=await post('auth/start',{});assert.equal(new URL((await login.json()).url).origin,'https://auth.openai.com');
 }finally{p.kill();await new Promise(resolve=>p.exitCode!==null?resolve():p.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
});
