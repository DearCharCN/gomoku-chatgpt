import http from 'node:http';
import { readFile,mkdir,open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join,dirname } from 'node:path';
import { randomBytes,randomUUID } from 'node:crypto';
import { openStorage } from './lib/storage.mjs';
import { Auth } from './lib/auth.mjs';
import { AI } from './lib/ai.mjs';
import { append,inspect } from './lib/game.mjs';
import { createTrace,timingLogger } from './lib/timing.mjs';
import { applySettings,validateEffort } from './lib/settings.mjs';
import { APIConnection } from './lib/api-connection.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3211),origin=`http://127.0.0.1:${port}`;
const dataRoot=process.env.GOMOKU_DATA_DIR||join(root,'.local');
await mkdir(dataRoot,{recursive:true,mode:0o700});
// Refuse a second process sharing rotating OAuth credentials and game files.
const lockPath=join(dataRoot,'server.lock');
let lock;
try{lock=await open(lockPath,'wx',0o600);await lock.writeFile(String(process.pid));await lock.close();}catch{console.error('数据目录已被占用。请关闭另一实例；若上次异常退出，确认没有实例运行后删除 .local/server.lock。');process.exit(1);}
const {unlinkSync}=await import('node:fs');
process.on('exit',()=>{try{unlinkSync(lockPath);}catch{}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>process.exit(0));
const storage=await openStorage(dataRoot),auth=new Auth(storage,origin);await auth.init();const ai=new AI(auth);
const apiConnection=new APIConnection(storage);await apiConnection.init();const apiAI=new AI(apiConnection,{provider:'api'});
const engines={chatgpt:ai,api:apiAI};
let games=await storage.read('games',[]),settings={provider:'chatgpt',reasoningEffort:'default',...await storage.read('settings',{model:'',humanColor:1})},busy=false;
const logTiming=timingLogger(join(dataRoot,'timing.jsonl'));
const cookieName='gomoku_'+port;
const sessions=new Map();let catalog=[],catalogAccount=null;
const persist=()=>storage.write('games',games);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>8192)throw new Error('请求过大');}return s?JSON.parse(s):{};}
function session(req,res,create=false){const id=(req.headers.cookie||'').match(new RegExp('(?:^|; )'+cookieName+'=([\\w-]+)'))?.[1];let s=sessions.get(id);if(s&&s.expiry<Date.now()){sessions.delete(id);s=null;}if(!s&&create){for(const [k,v] of sessions)if(v.expiry<Date.now())sessions.delete(k);const id=randomBytes(32).toString('base64url');s={id,csrf:randomBytes(32).toString('base64url'),expiry:Date.now()+86400000};sessions.set(id,s);res.setHeader('Set-Cookie',`${cookieName}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);}return s;}
function providerName(value='chatgpt'){if(!Object.hasOwn(engines,value))throw new Error('请选择有效的 AI 连接方式');return value;}
function catalogKey(provider){return provider+':'+(provider==='api'?apiConnection.record?.id:auth.data.active);}
async function models(provider=settings.provider,trace){providerName(provider);catalog=await engines[provider].models(trace);catalogAccount=catalogKey(provider);return catalog;}
async function requireModel(id,trace,provider='chatgpt'){providerName(provider);const cacheHit=catalogAccount===catalogKey(provider)&&!!catalog.length;trace?.mark('model_catalog_check_start',{cacheHit});if(!cacheHit)await models(provider,trace);const model=catalog.find(m=>m.id===id);if(!model)throw new Error('请选择当前连接可用的模型');trace?.mark('model_catalog_ready',{cacheHit});return model;}
function engineForGame(game){const provider=providerName(game.provider||'chatgpt');if(provider==='api'&&game.connectionId!==apiConnection.record?.id)throw new Error('当前 API 连接与此棋局不一致，请恢复创建该棋局时的 API 地址和协议');return engines[provider];}
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Gomoku-Studio','1');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end('请使用 '+origin);}
  const url=new URL(req.url,origin);
  const trace=(url.pathname.startsWith('/api/games/')||url.pathname.startsWith('/api/api/')||url.pathname==='/api/settings'||url.pathname==='/api/models')?createTrace(logTiming,{operation:url.pathname.split('/').pop()}):null;
  trace?.mark('request_received');
  res.once('finish',()=>trace?.mark('response_finished',{httpStatus:res.statusCode}));
  res.once('close',()=>{if(!res.writableFinished)trace?.mark('client_disconnected');});
  try{
    if(req.method==='GET'&&files[url.pathname]){session(req,res,true);const name=files[url.pathname];res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');return res.end(await readFile(join(root,'public',name)));}
    const s=session(req,res);
    if(!s)return json(res,401,{error:'会话已过期，请刷新页面'});
    if(req.method==='GET'&&url.pathname==='/auth/callback'){
      if(busy)throw new Error('请等待当前请求结束后重新连接');
      busy=true;try{await auth.callback(url,s.id);catalog=[];catalogAccount=null;settings.model='';await storage.write('settings',settings);}finally{busy=false;}
      res.writeHead(303,{Location:'/?connected=1'});return res.end();
    }
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,{version:'1.1.0',csrf:s.csrf,auth:auth.status(),apiConnection:apiConnection.status(),settings,games,busy});
    if(req.method==='GET'&&url.pathname==='/api/models'){
      if(busy)return json(res,409,{error:'正在处理上一个请求，请稍后刷新模型'});
      busy=true;try{return json(res,200,{models:await models(url.searchParams.get('provider')||settings.provider,trace)});}finally{busy=false;}
    }
    if(req.method!=='POST')return json(res,404,{error:'页面不存在'});
    if(req.headers.origin!==origin||req.headers['x-csrf-token']!==s.csrf)return json(res,403,{error:'请求验证失败，请刷新页面'});
    if(busy)return json(res,409,{error:'正在处理上一个请求，请稍候'});
    busy=true;
    try{
      const b=await body(req);
      if(url.pathname==='/api/api/connect'){
        const candidate=apiConnection.prepare(b),testAI=new AI(candidate,{provider:'api'});trace?.mark('api_models_fetch_start');
        const list=await testAI.models(trace);if(!list.length)throw new Error('API 没有返回可用的模型 ID');
        await apiConnection.commit(candidate);catalog=list;catalogAccount=catalogKey('api');trace?.mark('api_connection_saved');
        return json(res,200,{models:list,apiConnection:apiConnection.status()});
      }
      if(url.pathname==='/api/api/disconnect'){await apiConnection.disconnect();catalog=[];catalogAccount=null;return json(res,200,{ok:true});}
      if(url.pathname==='/api/auth/start')return json(res,200,{url:await auth.start(s.id,b.accountId)});
      if(url.pathname==='/api/auth/select'){await auth.select(b.id);catalog=[];catalogAccount=null;settings.model='';await storage.write('settings',settings);return json(res,200,{ok:true});}
      if(url.pathname==='/api/auth/logout'){const result=await auth.logout();catalog=[];catalogAccount=null;return json(res,200,result);}
      if(url.pathname==='/api/settings'){const provider=providerName(b.provider);const model=await requireModel(b.model,trace,provider);settings=applySettings(settings,{...b,provider},model,games);await storage.write('settings',settings);if(b.applyToCurrent)await persist();trace?.mark('settings_saved',{model:settings.model,reasoningEffort:settings.reasoningEffort,provider});return json(res,200,{ok:true});}
      if(url.pathname==='/api/games/new'){
        await engines[settings.provider].auth.access(trace);const model=await requireModel(settings.model,trace,settings.provider);validateEffort(model,settings.reasoningEffort);
        if(games.some(g=>g.status==='playing'))throw new Error('请先完成或认输当前棋局');
        const game={id:randomUUID(),createdAt:new Date().toISOString(),humanColor:settings.humanColor,provider:settings.provider,...(settings.provider==='api'?{connectionId:apiConnection.record.id}:{}),model:settings.model,reasoningEffort:settings.reasoningEffort,moves:[],status:'playing',winner:0,review:null};games.unshift(game);await persist();trace?.mark('game_saved',{gameId:game.id});return json(res,200,{game});
      }
      const game=games.find(g=>g.id===b.id);if(!game)throw new Error('棋局不存在');
      trace?.mark('game_loaded',{gameId:game.id,model:game.model,provider:game.provider||'chatgpt',reasoningEffort:game.reasoningEffort||'default',ply:game.moves.length+1});
      if(url.pathname==='/api/games/move'){
        if(inspect(game.moves).next!==game.humanColor)throw new Error('请等待 AI 落子');append(game,b.x,b.y);trace?.mark('move_validated');await persist();trace?.mark('game_saved');return json(res,200,{game});
      }
      if(url.pathname==='/api/games/ai'){
        if(game.status!=='playing'||inspect(game.moves).next===game.humanColor)throw new Error('现在不是 AI 回合');
        const engine=engineForGame(game);validateEffort(await requireModel(game.model,trace,game.provider||'chatgpt'),game.reasoningEffort);const move=await engine.move(game,trace);append(game,move.x,move.y);trace?.mark('board_updated');await persist();trace?.mark('game_saved');return json(res,200,{game});
      }
      if(url.pathname==='/api/games/resign'){
        if(game.status!=='playing')throw new Error('棋局已经结束');game.status='finished';game.winner=3-game.humanColor;game.result='resign';game.finishedAt=new Date().toISOString();await persist();return json(res,200,{game});
      }
      if(url.pathname==='/api/games/review'){
        if(game.status!=='finished')throw new Error('请在棋局结束后复盘');if(!game.moves.length)throw new Error('尚无落子可以复盘');
        if(!game.review){const engine=engineForGame(game);validateEffort(await requireModel(game.model,trace,game.provider||'chatgpt'),game.reasoningEffort);game.review=await engine.review(game,trace);await persist();trace?.mark('game_saved');}else trace?.mark('review_cache_hit',{cacheHit:true});return json(res,200,{game});
      }
      return json(res,404,{error:'接口不存在'});
    }finally{busy=false;}
  }catch(e){
    trace?.mark('request_error',{errorType:e.name});
    // Do not expose provider bodies, authorization URLs, codes, or tokens.
    const safe=e.message&&/[\u4e00-\u9fff]/.test(e.message)?e.message:'请求失败，请检查网络后重试';
    if(url.pathname==='/auth/callback'){res.writeHead(303,{Location:'/?loginError='+encodeURIComponent(safe)});return res.end();}
    json(res,400,{error:safe});
  }
});
server.requestTimeout=300000;server.listen(port,'127.0.0.1',()=>console.log('Gomoku Studio 已启动：'+origin));
server.on('error',()=>{console.error('启动失败，请检查端口是否被占用');process.exit(1);});
