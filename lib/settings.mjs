import {validateGameType} from './games.mjs';
export const effortNames={default:'模型默认',none:'不思考',minimal:'极低',low:'低 · 更快响应',medium:'中 · 均衡',high:'高 · 更深入',xhigh:'很高',max:'最高',ultra:'超高 · 可能自动委派'};
export function modelInfo(m,{api=false}={}){
  const raw=Array.isArray(m.supported_reasoning_levels)?m.supported_reasoning_levels:[];
  const efforts=[...new Set(raw.map(x=>typeof x==='string'?x:x.effort).filter(x=>x!=='default'&&Object.hasOwn(effortNames,x)))];
  return {id:m.slug||m.id,name:m.display_name||m.slug||m.id,reasoningEfforts:efforts.length||!api?efforts:['low','medium','high'],reasoningSupport:efforts.length?'declared':api?'unverified':'unknown',defaultReasoningEffort:typeof m.default_reasoning_level==='string'?m.default_reasoning_level:null};
}
export function validateEffort(model,value){
  const effort=value??'default';
  if(effort!=='default'&&!model.reasoningEfforts?.includes(effort))throw new Error('此模型不支持所选思考强度，请刷新模型列表后重新选择');
  return effort;
}
export function applySettings(current,body,model,games){
  const gameType=validateGameType(body.gameType||current.gameType),reasoningEffort=validateEffort(model,body.reasoningEffort);
  const active=games.find(g=>g.status==='playing');
  if(body.applyToCurrent&&active){
    if(active.model!==model.id||(active.provider||'chatgpt')!==(body.provider||'chatgpt'))throw new Error('当前棋局与所选连接方式或模型不同，无法同步思考强度；请取消应用到当前棋局');
    active.reasoningEffort=reasoningEffort;
  }
  return {...current,gameType,provider:body.provider||'chatgpt',model:model.id,humanColor:body.humanColor===2?2:1,reasoningEffort};
}
