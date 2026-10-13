import test from 'node:test';
import assert from 'node:assert/strict';
import {modelInfo,validateEffort,applySettings} from '../lib/settings.mjs';
test('模型目录提供强度；未知档位过滤，缺少能力时仅允许默认',()=>{
 const m=modelInfo({slug:'m',supported_reasoning_levels:[{effort:'low'},{effort:'high'},{effort:'invented'}],default_reasoning_level:'high'});
 assert.deepEqual(m.reasoningEfforts,['low','high']);assert.equal(m.defaultReasoningEffort,'high');assert.equal(validateEffort(m,'low'),'low');assert.throws(()=>validateEffort(m,'none'));
 assert.equal(validateEffort(modelInfo({slug:'unknown'}),undefined),'default');assert.throws(()=>validateEffort(modelInfo({slug:'unknown'}),'high'));
});
test('可同步本局下次请求；拒绝跨模型同步，兼容老版本默认强度',()=>{
 const m={id:'m',reasoningEfforts:['low','high']},g={status:'playing',model:'m',moves:[{x:7,y:7}]};
 const s=applySettings({}, {model:'m',humanColor:1,reasoningEffort:'low',applyToCurrent:true},m,[g]);assert.equal(g.reasoningEffort,'low');assert.equal(s.reasoningEffort,'low');assert.equal(g.moves.length,1);
 applySettings(s,{reasoningEffort:'high'},m,[g]);assert.equal(g.reasoningEffort,'low');
 assert.throws(()=>applySettings(s,{reasoningEffort:'high',applyToCurrent:true},{id:'other',reasoningEfforts:['high']},[g]));
 assert.equal(applySettings(s,{},m,[]).reasoningEffort,'default');
});
