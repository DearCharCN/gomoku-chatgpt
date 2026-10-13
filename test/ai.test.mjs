import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSSE,AI} from '../lib/ai.mjs';
function stream(events,chunk=5){const raw=events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('');const bytes=new TextEncoder().encode(raw);return new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=chunk)c.enqueue(bytes.slice(i,i+chunk));c.close();}});}
test('跨分片 UTF-8 与 SSE 事件完成后才接受结果',async()=>{assert.equal(await consumeSSE(stream([{type:'response.output_text.delta',delta:'测试棋局'},{type:'response.completed',response:{status:'completed'}}])),'测试棋局');});
test('流中断、额度错误与不完整结果均不能充当 AI 回答',async()=>{for(const ending of [null,{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}},{type:'response.incomplete'}]){const events=[{type:'response.output_text.delta',delta:'{"x":7,"y":7}'}];if(ending)events.push(ending);await assert.rejects(consumeSSE(stream(events)));}});
test('AI 非法落点只重试一次，不做本地算法回退',async()=>{const ai=new AI(null),g={moves:[{x:7,y:7}],humanColor:1,model:'test',status:'playing'};let calls=0;ai.request=async()=>{calls++;return {x:7,y:7};};await assert.rejects(ai.move(g),/非法落点/);assert.equal(calls,2);ai.request=async()=>({x:6,y:7});assert.deepEqual(await ai.move(g),{x:6,y:7});});
