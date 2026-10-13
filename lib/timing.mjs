import { createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
const fields=new Set(['operation','gameId','provider','model','reasoningEffort','ply','attempt','status','cacheHit','refreshed','httpStatus','providerRequestId','requestBytes','inputTokens','outputTokens','reasoningTokens','totalMs','credentialsMs','headersMs','firstByteMs','firstEventMs','firstTextMs','completedMs','streamTailMs','parseMs','reason','errorType']);
export function safeMetadata(data){return Object.fromEntries(Object.entries(data).filter(([key,value])=>fields.has(key)&&['string','number','boolean'].includes(typeof value)).map(([key,value])=>[key,typeof value==='string'?value.slice(0,160):value]));}
export function createTrace(sink,metadata={},clock=()=>performance.now()){
  const start=clock(),requestId=randomUUID(),base=safeMetadata(metadata);
  return {requestId,mark(stage,data={}){sink({time:new Date().toISOString(),requestId,...base,stage,elapsedMs:+(clock()-start).toFixed(2),...safeMetadata(data)});}};
}
export function timingLogger(path){
  const stream=createWriteStream(path,{flags:'a',mode:0o600});let failed=false;
  stream.on('error',()=>{if(!failed)console.error('分段耗时日志写入失败，请检查磁盘空间和目录权限');failed=true;});
  return record=>{if(!failed)stream.write(JSON.stringify(record)+'\n');};
}
