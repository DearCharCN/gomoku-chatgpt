import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrace} from '../lib/timing.mjs';
import {AI} from '../lib/ai.mjs';
test('日志字段白名单不记录令牌、提示词或错误正文',()=>{const rows=[];let time=0;const trace=createTrace(r=>rows.push(r),{operation:'ai',token:'SECRET'},()=>time);time=25;trace.mark('test',{model:'m',prompt:'PRIVATE',error:'SECRET',reasoningTokens:12});assert.equal(rows[0].elapsedMs,25);assert.equal(rows[0].reasoningTokens,12);assert.ok(!JSON.stringify(rows).includes('SECRET'));assert.ok(!JSON.stringify(rows).includes('PRIVATE'));});
test('思考强度正确传入请求，默认时省略；记录完整分段与 token 数',async t=>{
 let payload;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  payload=JSON.parse(options.body);
  const events=[{type:'response.created'},{type:'response.output_text.delta',delta:'{"x":7,"y":7}'},{type:'response.completed',response:{status:'completed',usage:{input_tokens:30,output_tokens:10,output_tokens_details:{reasoning_tokens:5}}}}];
  return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'x-request-id':'req_test'}});
 });
 const ai=new AI({access:async()=> 'SECRET'}),rows=[],trace=createTrace(r=>rows.push(r));
 assert.deepEqual(await ai.request('m','SECRET INSTRUCTIONS','PRIVATE PROMPT',{reasoningEffort:'low',trace}),{x:7,y:7});assert.deepEqual(payload.reasoning,{effort:'low'});
 const stages=rows.map(r=>r.stage);
 for(const stage of ['attempt_start','credentials_ready','upstream_request_sent','response_headers','first_byte','first_event','first_text','response_completed','stream_end','json_parsed','attempt_summary'])assert.ok(stages.includes(stage),stage);
 assert.equal(rows.find(r=>r.stage==='response_completed').reasoningTokens,5);
 assert.equal(rows.at(-1).status,'completed');assert.ok(rows.at(-1).streamTailMs>=0);assert.ok(!JSON.stringify(rows).includes('SECRET'));assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
 await ai.request('m','a','b');assert.ok(!('reasoning' in payload));
});
test('流中途失败也保存失败摘要，且不输出上游错误敏感正文',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('data: '+JSON.stringify({type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded',message:'SECRET'}}})+'\n\n'));
 const rows=[],ai=new AI({access:async()=> 'TOKEN'});await assert.rejects(ai.request('m','i','p',{trace:createTrace(r=>rows.push(r))}));
 assert.equal(rows.at(-1).stage,'attempt_summary');assert.equal(rows.at(-1).status,'failed');assert.ok(!JSON.stringify(rows).includes('SECRET'));
});
test('非法落点重试单独记录 attempt 1 和 2',async t=>{
 let i=0;t.mock.method(globalThis,'fetch',async()=>new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(i++?{x:6,y:7}:{x:7,y:7})}]}]}})+'\n\n'));
 const rows=[],ai=new AI({access:async()=> 'TOKEN'});await ai.move({moves:[{x:7,y:7}],model:'m',humanColor:1,status:'playing',reasoningEffort:'low'},createTrace(r=>rows.push(r)));
 assert.ok(rows.some(r=>r.stage==='retry_scheduled'));assert.deepEqual(rows.filter(r=>r.stage==='attempt_summary').map(r=>r.attempt),[1,2]);
});
