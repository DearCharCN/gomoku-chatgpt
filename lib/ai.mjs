import {transcript,inspectGame,validateReview,gameType,cleanMove} from './games.mjs';
import {types,movingType} from '../public/game-types.mjs';
import { modelInfo } from './settings.mjs';
const endpoint='https://api.openai.com/v1';
function failure(code,status,api=false) {
  if(api)return new Error(status===401?'API Token 无效或已过期':status===429?'API 额度不足或触发限流，请检查服务商用量':status===400?'API 拒绝了请求参数；请检查协议、模型和思考强度，可尝试「模型默认」':status===404?'API 接口或模型不存在，请检查 Base URL 和协议':'API 请求未完成，请检查服务商连接'+(status?'（HTTP '+status+'）':''));
  if(status===429||/usage_limit|usage_unavailable/.test(code||''))return new Error('ChatGPT 套餐或应用额度暂不可用，请到设置中的「管理用量」查看');
  if(status===401)return new Error('ChatGPT 登录已失效，请在设置中重新连接');
  if(status===403)return new Error('该账户未获准使用此模型或套餐，请更换模型或重新授权');
  return new Error('ChatGPT 请求未完成，请稍后重试'+(status?'（HTTP '+status+'）':''));
}
export async function consumeSSE(stream,{onChunk=()=>{},onEvent=()=>{},protocol='responses'}={}){
  let buffer='',text='',completed=false,chatFinished=false,chatUsage;
  function event(block){const raw=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!raw)return;
    if(raw==='[DONE]'){
      if(protocol==='chat'&&chatFinished){completed=true;onEvent({type:'response.completed',response:{status:'completed',usage:chatUsage}});}return;
    }
    const e=JSON.parse(raw);
    if(protocol==='chat'){
      onEvent({type:'chat.chunk'});
      if(e.error)throw failure('',undefined,true);
      if(e.usage)chatUsage={input_tokens:e.usage.prompt_tokens,output_tokens:e.usage.completion_tokens,output_tokens_details:e.usage.completion_tokens_details};
      const choice=e.choices?.[0];
      if(choice?.delta?.reasoning_content||choice?.delta?.reasoning)onEvent({type:'response.output_item.added',item:{type:'reasoning'}});
      if(typeof choice?.delta?.content==='string'&&choice.delta.content){text+=choice.delta.content;onEvent({type:'response.output_text.delta'});}
      if(choice?.finish_reason){if(choice.finish_reason!=='stop')throw new Error('API 回答未正常完成（输出截断或不支持的结束类型），请重试');chatFinished=true;}
      return;
    }
    onEvent(e);
    if(e.type==='response.output_text.delta')text+=e.delta;
    if(e.type==='response.failed'||e.type==='error')throw failure(e.response?.error?.code||e.code);
    if(e.type==='response.incomplete')throw new Error('AI 回答不完整，请重试');
    if(e.type==='response.completed'){if(e.response?.status&&e.response.status!=='completed')throw new Error('AI 未完成回答');completed=true;if(!text)text=(e.response?.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');}
  }
  const decoder=new TextDecoder();
  for await(const chunk of stream){onChunk();buffer+=decoder.decode(chunk,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let i;while((i=buffer.indexOf('\n\n'))!==-1){event(buffer.slice(0,i));buffer=buffer.slice(i+2);}}
  buffer+=decoder.decode();if(buffer.trim())event(buffer);
  if(!completed)throw new Error('连接中断，AI 未完成回答；棋局已保留');
  return text;
}
export class AI {
  constructor(auth,{provider='chatgpt'}={}){this.auth=auth;this.provider=provider;}
  async models(trace){const token=await this.auth.access(trace);const api=this.provider==='api';const r=await fetch((api?this.auth.record.baseUrl:endpoint)+'/models',{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw failure('',r.status,api);const j=await r.json();if(api){const list=j.data||j.models;if(!Array.isArray(list))throw new Error('API 模型列表格式不受支持，预期 data 或 models 数组');return list.filter(m=>typeof (m.id||m.slug)==='string').map(m=>modelInfo(m,{api:true}));}if(!Array.isArray(j.models))throw new Error('账户模型目录格式不受支持');return j.models.filter(m=>m.visibility==='list').map(m=>modelInfo(m));}
  async request(model,instructions,prompt,{reasoningEffort='default',trace,attempt=1}={}){
    const start=performance.now(),times={};let outcome='failed';
    const ms=()=>+(performance.now()-start).toFixed(2);
    const mark=(name,meta={})=>{times[name]=ms();trace?.mark(name,{attempt,...meta});};
    mark('attempt_start');
    try{
      const token=await this.auth.access(trace);mark('credentials_ready');
      const api=this.provider==='api',protocol=api?this.auth.record.protocol:'responses';
      const payload=protocol==='chat'?{model,messages:[{role:'system',content:instructions},{role:'user',content:prompt}],stream:true}:{model,instructions,input:[{role:'user',content:prompt}],store:false,stream:true};
      if(reasoningEffort!=='default'){if(protocol==='chat')payload.reasoning_effort=reasoningEffort;else payload.reasoning={effort:reasoningEffort};}
      const body=JSON.stringify(payload);mark('upstream_request_sent',{requestBytes:Buffer.byteLength(body)});
      const r=await fetch((api?this.auth.record.baseUrl:endpoint)+(protocol==='chat'?'/chat/completions':'/responses'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(240000)});
      const requestId=r.headers.get('x-request-id')||r.headers.get('openai-request-id');
      mark('response_headers',{httpStatus:r.status,...(requestId&&/^[\w-]{1,160}$/.test(requestId)?{providerRequestId:requestId}:{})});
      if(!r.ok)throw failure('',r.status,api);
      const seen=new Set();
      const once=(stage,meta)=>{if(!seen.has(stage)){seen.add(stage);mark(stage,meta);}};
      const text=await consumeSSE(r.body,{protocol,onChunk:()=>once('first_byte'),onEvent:e=>{
        once('first_event');
        if(e.type==='response.created')once('response_created');
        if(e.type==='response.output_item.added'&&e.item?.type==='reasoning')once('reasoning_item_received');
        if(e.type==='response.output_text.delta')once('first_text');
        if(e.type==='response.completed'){
          const usage=e.response?.usage;
          once('response_completed',{inputTokens:usage?.input_tokens,outputTokens:usage?.output_tokens,reasoningTokens:usage?.output_tokens_details?.reasoning_tokens});
        }
        if(e.type==='response.failed'||e.type==='response.incomplete'||e.type==='error')mark('upstream_terminal_error',{reason:e.type});
      }});
      mark('stream_end');let result;
      try{result=JSON.parse(text.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new Error('AI 未返回有效棋谱数据，请重试');}
      mark('json_parsed');outcome='completed';return result;
    }catch(e){trace?.mark('attempt_error',{attempt,errorType:e.name});throw e;}
    finally{
      const diff=(a,b)=>times[a]!==undefined&&times[b]!==undefined?+(times[a]-times[b]).toFixed(2):undefined;
      trace?.mark('attempt_summary',{attempt,status:outcome,totalMs:ms(),credentialsMs:times.credentials_ready,headersMs:diff('response_headers','upstream_request_sent'),firstByteMs:diff('first_byte','upstream_request_sent'),firstEventMs:diff('first_event','upstream_request_sent'),firstTextMs:diff('first_text','upstream_request_sent'),completedMs:diff('response_completed','upstream_request_sent'),streamTailMs:diff('stream_end','response_completed'),parseMs:diff('json_parsed','stream_end')});
    }
  }
  async move(game,trace){
    const context=transcript(game),type=gameType(game),definition=types[type];let correction='';trace?.mark('prompt_ready');
    const shape=movingType(type)?'{"fromX":0,"fromY":0,"x":0,"y":0}':type==='go'?'{"x":0,"y":0}，停着用 {"pass":true}':'{"x":0,"y":0}';
    for(let attempt=0;attempt<2;attempt++){
      const result=await this.request(game.model,'你是'+definition.name+'对手。只输出 JSON，不调用工具。按所给规则自行选择走法，优先保住胜负关键，兼顾局势。'+(type==='gomoku'?'优先成五、阻止对手成五，再考虑活三、冲四和双威胁。':'必须从 legalMoves 中选择；列表没有按棋力排序。')+(type==='go'?'只有认为无需继续落子时才停着；终局前应提净死子。':''),JSON.stringify(context)+'\n轮到你执'+definition.colors[2-game.humanColor]+'，输出 '+shape+'。'+correction,{reasoningEffort:game.reasoningEffort||'default',trace,attempt:attempt+1});
      try{inspectGame({...game,moves:[...game.moves,result]});trace?.mark('move_validated',{attempt:attempt+1});return cleanMove(game,result);}catch{trace?.mark(attempt===0?'retry_scheduled':'invalid_move',{attempt:attempt+1,reason:'illegal_move'});correction='上次走法不合法。请重新检查规则并选择一个合法走法。';}
    }
    throw new Error('AI 连续返回非法走法，请重试；没有使用本地 AI 代下');
  }
  async review(game,trace){
    const type=gameType(game),shape=movingType(type)?'{"fromX":0,"fromY":0,"x":0,"y":0}':type==='go'?'{"x":0,"y":0} 或 {"pass":true}':'{"x":0,"y":0}';
    const prompt=JSON.stringify(transcript(game))+'\n输出结构：{"summary":"总体评价与局限","firstImprovement":最早可改进的人类落子序号或null,"points":[{"ply":人类落子的全局序号,"title":"问题","explanation":"原因及后续思路","betterMove":'+shape+'或null}],"practice":["练习建议"]}。points 按先后排序，选取最多6个关键节点。没有明确问题则 firstImprovement 为 null 且 points 为空。';
    trace?.mark('prompt_ready');
    const result=await this.request(game.model,'你是'+types[type].name+'教练。检查完整棋谱，着重分析人类玩家最早的明确改进机会。替代走法必须在该步之前合法。不虚构引擎评分、胜率或穷尽搜索。用中文给出具体威胁、替代着法及后续思路；不确定时说明。只输出 JSON。',prompt,{reasoningEffort:game.reasoningEffort||'default',trace});
    const review=validateReview(result,game);trace?.mark('review_validated');return review;
  }
}
