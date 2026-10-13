import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeBaseUrl,APIConnection} from '../lib/api-connection.mjs';
import {consumeSSE} from '../lib/ai.mjs';
test('API 地址校验，更换服务器或协议不能沿用旧 Token',()=>{
 assert.equal(normalizeBaseUrl('https://example.com/v1/'),'https://example.com/v1');
 for(const value of ['file:///tmp','https://a:b@example.com','https://example.com?token=x','https://example.com/v1/models'])assert.throws(()=>normalizeBaseUrl(value));
 const a=new APIConnection(null);a.record={baseUrl:'https://example.com/v1',protocol:'chat',token:'FAKE_TOKEN'};
 assert.equal(a.prepare({baseUrl:a.record.baseUrl}).record.token,'FAKE_TOKEN');assert.throws(()=>a.prepare({baseUrl:'https://different.example/v1'}));assert.throws(()=>a.prepare({baseUrl:a.record.baseUrl,protocol:'responses'}));
 assert.ok(!JSON.stringify(a.status()).includes('FAKE_TOKEN'));
});
test('Chat Completions 必须正常 stop 且收到 DONE；截断不采纳',async()=>{
 const body=e=>new Response('data: '+JSON.stringify(e)+'\n\ndata: [DONE]\n\n').body;
 assert.equal(await consumeSSE(body({choices:[{delta:{content:'hello'},finish_reason:'stop'}]}),{protocol:'chat'}),'hello');
 await assert.rejects(consumeSSE(body({choices:[{delta:{content:'half'},finish_reason:'length'}]}),{protocol:'chat'}));
 await assert.rejects(consumeSSE(new Response('data: {"choices":[{"delta":{"content":"half"},"finish_reason":"stop"}]}\n\n').body,{protocol:'chat'}));
});
test('API 完整集成：获取模型、两种协议、强度、落子、复盘、日志且 Token 不回显',async()=>{
 const requests=[];const mock=http.createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer TEST_ONLY_TOKEN'){res.writeHead(401);return res.end('{}');}
  if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:[{id:'test-model',supported_reasoning_levels:[{effort:'low'},{effort:'high'}]}]}));}
  let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw);requests.push({url:req.url,...b});
  const review=(b.instructions||b.messages?.[0]?.content||'').includes('教练');
  const context=JSON.parse((b.input?.[0]?.content||b.messages?.[1]?.content).split('\n')[0]);
  const text=JSON.stringify(review?{summary:'模拟复盘',firstImprovement:null,points:[],practice:['练习防守']}:(context.gameType==='xiangqi'?context.legalMoves[0]:{x:7,y:7}));
  res.setHeader('Content-Type','text/event-stream');res.flushHeaders();
  if(req.url==='/v1/chat/completions')res.write('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
  else res.write('data: '+JSON.stringify({type:'response.output_text.delta',delta:text})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n');
  setTimeout(()=>res.end(),25);
 });
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));const baseUrl=`http://127.0.0.1:${mock.address().port}/v1`;
 const dir=await mkdtemp(join(tmpdir(),'gomoku-api-test-'));const port=33220,origin=`http://127.0.0.1:${port}`;
 const p=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),GOMOKU_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});p.stderr.resume();
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server timeout')),10000);p.stdout.on('data',()=>{clearTimeout(timer);resolve();});p.on('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'));});});
  const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith('gomoku_33220='));
  const getState=()=>fetch(origin+'/api/state',{headers:{Cookie:cookie}}).then(r=>r.json());const s=await getState();
  const post=async(path,data)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;};
  for(const protocol of ['chat','responses'])for(const gameType of ['gomoku','xiangqi']){
   const connect=await post('api/connect',{baseUrl,token:'TEST_ONLY_TOKEN',protocol});assert.equal(connect.models[0].id,'test-model');assert.ok(!JSON.stringify(connect).includes('TEST_ONLY_TOKEN'));
   await post('settings',{provider:'api',model:'test-model',reasoningEffort:'low',humanColor:2,gameType});
   let {game}=await post('games/new',{});assert.equal(game.provider,'api');assert.equal(game.gameType,gameType);
   ({game}=await post('games/ai',{id:game.id}));assert.equal(game.moves.length,1);
   await post('settings',{provider:'api',model:'test-model',reasoningEffort:'high',humanColor:2,applyToCurrent:true});
   await post('games/resign',{id:game.id});({game}=await post('games/review',{id:game.id}));assert.equal(game.review.summary,'模拟复盘');
   const move=requests.at(-2),review=requests.at(-1);
   if(protocol==='chat'){assert.equal(move.reasoning_effort,'low');assert.equal(review.reasoning_effort,'high');assert.ok(!('reasoning' in move));}
   else {assert.deepEqual(move.reasoning,{effort:'low'});assert.deepEqual(review.reasoning,{effort:'high'});assert.equal(move.store,false);}
  }
  assert.ok(!JSON.stringify(await getState()).includes('TEST_ONLY_TOKEN'));
  const lines=(await readFile(join(dir,'timing.jsonl'),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
  assert.ok(lines.some(x=>x.stage==='attempt_summary'&&x.streamTailMs>=15));assert.ok(lines.some(x=>x.stage==='game_saved'));assert.ok(!JSON.stringify(lines).includes('TEST_ONLY_TOKEN'));
  await post('api/disconnect',{});assert.equal((await getState()).apiConnection.configured,false);
 }finally{p.kill();await new Promise(r=>p.exitCode!==null?r():p.once('exit',r));await new Promise(r=>mock.close(r));await rm(dir,{recursive:true,force:true});}
});
