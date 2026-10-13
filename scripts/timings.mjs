import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const path=join(process.env.GOMOKU_DATA_DIR?resolve(process.env.GOMOKU_DATA_DIR):join(root,'.local'),'timing.jsonl');
let source;try{source=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT'){console.log('暂无耗时日志；完成一次 AI 落子或复盘后再查看。');process.exit(0);}throw e;}
const groups=new Map();
for(const line of source.split('\n')){let r;try{r=JSON.parse(line);}catch{continue;}if(!['ai','review'].includes(r.operation))continue;const group=groups.get(r.requestId)||{attempts:[]};Object.assign(group,r);if(r.stage==='attempt_summary')group.attempts.push(r);groups.set(r.requestId,group);}
const seconds=n=>typeof n==='number'?(n/1000).toFixed(3)+'s':'—';
console.table([...groups.values()].slice(-20).map(g=>({时间:new Date(g.time).toLocaleString('zh-CN'),请求:g.requestId.slice(0,8),操作:g.operation,模型:g.model,强度:g.reasoningEffort,手数:g.ply,尝试:g.attempts.length,状态:g.stage,本地接口总计:seconds(g.elapsedMs),授权检查:g.attempts.map(a=>seconds(a.credentialsMs)).join(' / '),响应头:g.attempts.map(a=>seconds(a.headersMs)).join(' / '),首段文本:g.attempts.map(a=>seconds(a.firstTextMs)).join(' / '),生成完成:g.attempts.map(a=>seconds(a.completedMs)).join(' / '),流收尾:g.attempts.map(a=>seconds(a.streamTailMs)).join(' / ')})));
console.log('响应头、首段文本、生成完成为每次上游请求发出后的累计耗时；等待时间包含网络与服务端处理，不代表纯思考。');
