import {colorOf} from './xiangqi.mjs';
import {types,typeOf,movingType,variantState,moveText} from './game-types.mjs';
import {drawVariant,ownerAt} from './variant-board.mjs';
import {drawXiangqi} from './xiangqi-board.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=(x,y)=>`${String.fromCharCode(65+x)}${15-y}`;
const effortLabels={default:'模型默认',none:'不思考',minimal:'极低',low:'低 · 更快响应',medium:'中 · 均衡',high:'高 · 更深入',xhigh:'很高',max:'最高',ultra:'超高 · 可能自动委派'};
let state,game=null,working=false,replay=null,suggestion=null,models=[],view='play',selectedSquare=null;
const currentType=()=>game?typeOf(game):$('modeSelect').value||state?.settings.gameType||'gomoku';
const typeName=g=>types[typeOf(g)].name;
function colorLabels(){const colors=types[currentType()].colors;$('firstColor').textContent=colors[0]+' · 先手';$('secondColor').textContent=colors[1]+' · 后手';}
const chatgptConnected=()=>state?.auth.accounts.find(a=>a.id===state.auth.active)?.connected;
const connected=(provider=state?.settings.provider||'chatgpt')=>provider==='api'?state?.apiConnection?.configured:chatgptConnected();
const currentProvider=()=>game?.provider||(game?'chatgpt':state?.settings.provider)||'chatgpt';
const nextColor=()=>game?game.moves.length%2+1:1;
function notice(message){$('notice').textContent=message||'';$('notice').hidden=!message;}
async function api(path,data){const r=await fetch('/api/'+path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':state.csrf},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||'请求失败');return j;}
function updateGame(g){selectedSquare=null;game=g;const i=state.games.findIndex(x=>x.id===g.id);if(i<0)state.games.unshift(g);else state.games[i]=g;replay=g.status==='finished'?g.moves.length:null;suggestion=null;}
async function run(fn){if(working)return;working=true;notice('');render();try{await fn();}catch(e){notice(e.message);}finally{working=false;render();}}
function result(g){return g.status==='playing'?'进行中':g.winner===0?'和棋':g.winner===g.humanColor?'你赢了':g.provider==='api'?'AI 获胜':'ChatGPT 获胜';}
function board(){
  const type=currentType(),xq=type==='xiangqi';$('board').className='board '+(type==='gomoku'?'':type);$('board').setAttribute('aria-label',types[type].name+'棋盘');$('variantInfo').hidden=true;$('board').style.removeProperty('grid-template-columns');$('board').style.removeProperty('grid-template-rows');
  if(['go','checkers','jungle'].includes(type)){
    const g=game||{gameType:type,boardSize:Number($('goSize').value),moves:[]},live=game?.status==='playing'&&!working&&!state.busy&&nextColor()===game.humanColor;
    const {html,info}=drawVariant({game:g,replay,selected:selectedSquare,suggestion,live,numbers:$('numbers').checked});$('board').innerHTML=html;$('variantInfo').hidden=false;$('variantInfo').textContent=info;
    if(type==='go'){const n=g.boardSize||9;$('board').style.gridTemplateColumns='repeat('+n+',1fr)';$('board').style.gridTemplateRows='repeat('+n+',1fr)';}
    if(live&&movingType(type))$('boardStatus').textContent=selectedSquare?'选择标记的落点，或点击另一枚己方棋子':'先选择棋子，再选择落点';return;
  }
  if(xq){const live=game?.status==='playing'&&!working&&!state.busy&&nextColor()===game.humanColor;const {html,check}=drawXiangqi({game,replay,suggestion,selected:selectedSquare,live});$('board').innerHTML=html;
    if(game?.status==='playing'&&!working&&!state.busy)$('boardStatus').textContent=check?'将军！请走出将军状态':live?(selectedSquare?'选择标记的落点，或点击另一枚己方棋子':'先选择棋子，再选择落点'):'等待 AI 走棋，可点击重试';return;}

  const moves=game?.moves||[],count=replay??moves.length,shown=moves.slice(0,count);let svg='<svg viewBox="0 0 450 450" aria-hidden="true">';
  for(let i=0;i<15;i++){const n=15+i*30;svg+=`<path d="M 15 ${n} H 435 M ${n} 15 V 435" stroke="#8d7b53" stroke-opacity=".5" stroke-width=".8"/>`;}
  for(const [x,y] of [[3,3],[11,3],[7,7],[3,11],[11,11]])svg+=`<circle cx="${15+x*30}" cy="${15+y*30}" r="2.5" fill="#8d7b53"/>`;
  svg+='</svg><div class="axes" aria-hidden="true">';
  for(let i=0;i<15;i++)svg+=`<span class="axis-x" style="left:${(i+.5)/15*100}%">${String.fromCharCode(65+i)}</span><span class="axis-y" style="top:${(i+.5)/15*100}%">${15-i}</span>`;
  svg+='</div>';
  const map=new Map(shown.map((m,i)=>[m.y*15+m.x,i]));
  const live=game?.status==='playing'&&!working&&!state?.busy&&nextColor()===game.humanColor;
  for(let y=0;y<15;y++)for(let x=0;x<15;x++){
    const index=map.get(y*15+x),occupied=index!==undefined,color=index%2?'white':'black';
    svg+=`<button class="cell${suggestion?.x===x&&suggestion?.y===y?' suggested':''}" data-x="${x}" data-y="${y}" aria-label="${coord(x,y)}${occupied?'，'+(color==='black'?'黑棋':'白棋')+'，第'+(index+1)+'手':''}" ${!live||occupied?'disabled':''}>${occupied?`<span class="stone ${color}${index===shown.length-1?' latest':''}">${$('numbers').checked?index+1:''}</span>`:''}</button>`;
  }
  $('board').innerHTML=svg;
}
function render(){
  if(!state)return;
  const isApi=currentProvider()==='api',isConnected=connected(currentProvider());$('connectionText').textContent=(isApi?'API':'ChatGPT')+(isConnected?' 已连接':' 未连接');$('connectionDot').parentElement.classList.toggle('connected',!!isConnected);
  $('opponentName').textContent=isApi?'AI 对手':'ChatGPT';
  $('playView').hidden=view!=='play';$('historyView').hidden=view!=='history';$('playTab').classList.toggle('active',view==='play');$('historyTab').classList.toggle('active',view==='history');
  const active=game?.status==='playing',busy=working||state.busy,aiTurn=active&&nextColor()!==game.humanColor,type=currentType(),xq=type==='xiangqi';
  if(game)$('modeSelect').value=typeOf(game);$('modeSelect').disabled=busy||state.games.some(g=>g.status==='playing');colorLabels();
  $('numbers').parentElement.hidden=movingType(type);$('goOptions').hidden=type!=='go';$('goSize').disabled=busy||active;if(game?.gameType==='go')$('goSize').value=String(game.boardSize||9);$('passMove').hidden=type!=='go';$('passMove').disabled=busy||!active||aiTurn;
  $('rulePill').textContent=types[type].name+(type==='go'?' · '+(game?.boardSize||$('goSize').value)+' 路':type==='checkers'?' · 双人':'' );
  $('ruleNote').textContent=types[type].rules;
  $('gameTitle').textContent=!game?'准备好，落下第一子':active?(aiTurn?(isApi?'AI':'ChatGPT')+' 正在思考':'轮到你了，落子吧'):result(game);
  $('boardStatus').textContent=busy?'正在处理，请稍候…':!game?'连接账户后开始对弈':active?aiTurn?'等待 AI 落子，可点击重试':'点击棋盘空位落子':suggestion?.pass?'建议在此停一手':suggestion?'推荐落点已标记 · 显示该手落子前局面':'棋局已结束 · 拖动进度条逐步回看';
  const color=game?.humanColor||state.settings.humanColor;
  $('humanStone').className='stone-icon '+(movingType(type)?(color===1?'red':xq?'black':'blue'):(color===1?'black':'white'));$('humanLabel').textContent=types[type].colors[color-1]+' · '+(color===1?'先手':'后手');
  const model=game?.model||state.settings.model;$('modelLabel').textContent=models.find(m=>m.id===model)?.name||model||'在设置中选择模型';
  $('effortLabel').textContent='思考强度：'+(effortLabels[(game?game.reasoningEffort:state.settings.reasoningEffort)||'default']||'模型默认');
  $('humanTurn').classList.toggle('current',!!active&&!aiTurn);$('humanTurn').textContent=active&&!aiTurn?'落子中':'玩家';$('aiTurn').classList.toggle('current',!!aiTurn);$('aiTurn').textContent=aiTurn?'思考中':'AI';
  $('planText').textContent=isApi?'API 用量由服务商计费':isConnected?'使用 ChatGPT 套餐':'通过 ChatGPT 账户授权套餐';
  document.querySelector('.plan a').hidden=isApi;
  $('newGame').disabled=busy||state.games.some(g=>g.status==='playing');$('resign').disabled=busy||!active;
  $('review').disabled=busy||!game||active||!game.moves.length;$('review').textContent=game?.review?'✧ 查看复盘':'✧ 复盘棋局';
  $('retry').hidden=!aiTurn;$('retry').disabled=busy;
  $('moveCount').textContent=(game?.moves.length||0)+' 手';
  $('moves').innerHTML=game?.moves.length?game.moves.map((m,i)=>`<button class="move-item${replay===i+1?' selected':''}" data-ply="${i+1}" ${active?'disabled':''}><span>${String(i+1).padStart(2,'0')}</span>${types[type].colors[i%2]} ${moveText(game,m)}</button>`).join(''):'<div class="empty">棋局，从一个落点开始。<small>你的每一步都会被记录。</small></div>';
  $('replayBar').hidden=!game||active;$('timeline').max=game?.moves.length||0;$('timeline').value=replay??0;$('stepLabel').textContent=`${replay??0} / ${game?.moves.length||0}`;
  board();renderReview();renderHistory();
}
function renderReview(){
  const r=game?.review;$('reviewPanel').hidden=!r;if(!r)return;
  $('reviewPanel').innerHTML=`<span class="eyebrow">REFLECT & GROW</span><h2>${r.firstImprovement?`从第 ${r.firstImprovement} 手，找到更好的选择`:'这一局的收获'}</h2><p>${esc(r.summary)}</p><div class="review-grid">${r.points.map((p,i)=>`<button class="review-point" data-point="${i}"><span>第 ${p.ply} 手 · ${moveText(game,game.moves[p.ply-1])} ${p.betterMove?'；建议 '+moveText(game,p.betterMove):''}</span><b>${esc(p.title)}</b><p>${esc(p.explanation)}</p><span>在棋盘上查看 ↗</span></button>`).join('')}</div><ul class="practice">${r.practice.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="fine">基于完整棋谱的 AI 分析，未使用专业棋力引擎验证；替代着法仅供学习参考。点击卡片查看该手落子前的局面。</p>`;
}
function renderHistory(){
  $('historyList').innerHTML=state.games.length?state.games.map(g=>`<button class="history-card" data-game="${esc(g.id)}"><span>${new Date(g.createdAt).toLocaleString('zh-CN')}</span><h3>${result(g)}</h3><p>${typeName(g)} · ${types[typeOf(g)].colors[g.humanColor-1]} · ${g.moves.length} 手 · ${esc(g.model)}</p><span>${g.review?'已生成复盘 · 查看关键着法':'查看棋谱'} ↗</span></button>`).join(''):'<div class="empty">还没有棋局。开始第一局，让进步有迹可循。</div>';
}
async function refreshModels(){
  $('settingsMessage').textContent='正在读取当前账户的模型…';
  try{models=(await api('models?provider='+$('providerSelect').value)).models;fillModels();$('settingsMessage').textContent=models.length?'':'当前连接没有返回可用模型。';}
  catch(e){models=[];$('modelSelect').innerHTML='<option value="">无法加载模型</option>';$('settingsMessage').textContent=e.message;}
  renderEfforts();render();
}
function fillModels(){const selected=$('providerSelect').value===state.settings.provider?state.settings.model:'';$('modelSelect').innerHTML=models.length?models.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name)}${m.name!==m.id?' · '+esc(m.id):''}</option>`).join(''):'<option value="">请先连接并获取模型</option>';}
function connectionPanels(){const isApi=$('providerSelect').value==='api';$('apiBox').hidden=!isApi;$('chatgptBox').hidden=isApi;$('apiDisconnect').hidden=!state.apiConnection?.configured;$('apiToken').placeholder=state.apiConnection?.configured?'已保存 · 留空保留原 Token':'填写 API Token';$('apiStatus').textContent=state.apiConnection?.configured?'已连接 '+state.apiConnection.baseUrl+'。Token 不会回显；API 用量由服务商计费。':'Token 仅由本地服务保存，不会回显。API 用量由对应服务商计费。';}
function renderEfforts(preferred){
  const model=models.find(m=>m.id===$('modelSelect').value),active=state.games.find(g=>g.status==='playing');
  const same=!!active&&active.model===model?.id&&(active.provider||'chatgpt')===$('providerSelect').value;
  const selected=preferred??(same?active.reasoningEffort:state.settings.reasoningEffort)??'default';
  const fallback=model?.defaultReasoningEffort;
  $('effortSelect').innerHTML=`<option value="default">模型默认${fallback?'（'+esc(effortLabels[fallback]||fallback)+'）':''}</option>`+(model?.reasoningEfforts||[]).map(v=>`<option value="${esc(v)}">${esc(effortLabels[v]||v)}</option>`).join('');
  $('effortSelect').value=['default',...(model?.reasoningEfforts||[])].includes(selected)?selected:'default';
  $('effortSelect').disabled=!model;
  $('effortHelp').textContent=model?.reasoningSupport==='unverified'?'此 API 未声明支持的强度，列出常见档位供选择；若接口拒绝参数，请选「模型默认」。':'低档通常更快；高档允许更深入的思考，但不保证棋力更强。';
  $('applyEffortLabel').hidden=!same;$('applyEffort').checked=same;
}
async function openSettings(){
  $('settingsDialog').showModal();$('settingsMessage').textContent='';
  $('providerSelect').value=state.settings.provider||'chatgpt';$('apiUrl').value=state.apiConnection?.baseUrl||'';$('apiProtocol').value=state.apiConnection?.protocol||'chat';$('apiToken').value='';connectionPanels();
  $('accounts').innerHTML=state.auth.accounts.length?`<select id="accountSelect" aria-label="ChatGPT 账户">${state.auth.accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===state.auth.active?'selected':''}>${esc(a.label)}${a.connected?'':'（已断开）'}</option>`).join('')}</select>`:'';
  $('reconnect').hidden=!state.auth.active;$('logout').hidden=!chatgptConnected();$('login').textContent=state.auth.accounts.length?'添加 ChatGPT 账户':'Continue with ChatGPT';
  document.querySelector(`input[name=color][value="${state.settings.humanColor}"]`).checked=true;
  if(connected())await refreshModels();else {$('modelSelect').innerHTML='<option value="">请先连接账户</option>';renderEfforts();}
}
async function reload(){const id=game?.id;state=await api('state');selectedSquare=null;game=(id?state.games.find(g=>g.id===id):null)||state.games.find(g=>g.status==='playing')||null;replay=game?.status==='finished'?game.moves.length:null;render();}
async function aiMove(){const {game:g}=await api('games/ai',{id:game.id});updateGame(g);}
$('board').addEventListener('click',e=>{const cell=e.target.closest('[data-x]');if(!cell||cell.disabled)return;const x=Number(cell.dataset.x),y=Number(cell.dataset.y);let move={x,y};if(movingType(currentType())){const s=variantState(game);const owner=currentType()==='xiangqi'?colorOf(s.board[y][x]):ownerAt(game,s,x,y);if(owner===game.humanColor){selectedSquare=selectedSquare?.x===x&&selectedSquare?.y===y?null:{x,y};board();return;}if(!selectedSquare)return;move={fromX:selectedSquare.x,fromY:selectedSquare.y,x,y};selectedSquare=null;}run(async()=>{const r=await api('games/move',{id:game.id,...move});updateGame(r.game);render();if(game.status==='playing')await aiMove();});});
$('newGame').onclick=()=>run(async()=>{if(!connected()||!state.settings.model){await openSettings();return;}const r=await api('games/new',{gameType:$('modeSelect').value,boardSize:Number($('goSize').value)});updateGame(r.game);view='play';render();if(game.humanColor===2)await aiMove();});
$('retry').onclick=()=>run(aiMove);
$('goSize').onchange=render;
$('passMove').onclick=()=>{$('passDialog').showModal();};$('cancelPass').onclick=()=>$('passDialog').close();$('confirmPass').onclick=()=>{$('passDialog').close();run(async()=>{updateGame((await api('games/move',{id:game.id,pass:true})).game);render();if(game.status==='playing')await aiMove();});};
$('modeSelect').onchange=()=>{if(state.games.some(g=>g.status==='playing'))return;game=null;selectedSquare=null;replay=null;suggestion=null;render();};
$('resign').onclick=()=>$('confirmDialog').showModal();$('cancelResign').onclick=()=>$('confirmDialog').close();
$('confirmResign').onclick=()=>{$('confirmDialog').close();run(async()=>updateGame((await api('games/resign',{id:game.id})).game));};
$('review').onclick=()=>run(async()=>{if(!game.review){notice('AI 正在检查完整棋谱，复盘可能需要几分钟…');updateGame((await api('games/review',{id:game.id})).game);notice('');}render();$('reviewPanel').scrollIntoView({behavior:'smooth',block:'start'});});
$('numbers').onchange=board;
function seek(n){if(!game||game.status==='playing')return;replay=Math.max(0,Math.min(game.moves.length,Number(n)));suggestion=null;render();}
$('timeline').oninput=e=>seek(e.target.value);$('first').onclick=()=>seek(0);$('last').onclick=()=>seek(game.moves.length);$('prev').onclick=()=>seek(replay-1);$('next').onclick=()=>seek(replay+1);
$('moves').onclick=e=>{const b=e.target.closest('[data-ply]');if(b)seek(b.dataset.ply);};
$('reviewPanel').onclick=e=>{const b=e.target.closest('[data-point]');if(!b)return;const p=game.review.points[Number(b.dataset.point)];replay=p.ply-1;suggestion=p.betterMove;render();$('board').scrollIntoView({behavior:'smooth',block:'center'});};
$('playTab').onclick=()=>{view='play';render();};$('historyTab').onclick=()=>{view='history';render();};
$('historyList').onclick=e=>{const b=e.target.closest('[data-game]');if(!b||working)return;game=state.games.find(g=>g.id===b.dataset.game);replay=game.status==='finished'?game.moves.length:null;suggestion=null;view='play';render();};
$('settingsOpen').onclick=()=>openSettings().catch(e=>notice(e.message));$('settingsClose').onclick=()=>$('settingsDialog').close();
$('refreshModels').onclick=refreshModels;
$('providerSelect').onchange=async()=>{models=[];fillModels();connectionPanels();renderEfforts();$('settingsMessage').textContent='';if(connected($('providerSelect').value))await refreshModels();};
$('apiConnect').onclick=async()=>{const button=$('apiConnect');button.disabled=true;$('settingsMessage').textContent='正在连接 API 并获取模型 ID…';try{const r=await api('api/connect',{baseUrl:$('apiUrl').value,token:$('apiToken').value,protocol:$('apiProtocol').value});state.apiConnection=r.apiConnection;$('apiUrl').value=r.apiConnection.baseUrl;$('apiToken').value='';models=r.models;fillModels();renderEfforts();connectionPanels();$('settingsMessage').textContent=`已读取 ${models.length} 个模型，请选择后保存设置。`;}catch(e){$('settingsMessage').textContent=e.message;}finally{button.disabled=false;}};
$('apiDisconnect').onclick=async()=>{try{await api('api/disconnect',{});await reload();models=[];fillModels();renderEfforts();connectionPanels();$('apiToken').value='';$('settingsMessage').textContent='已清除本地 API 连接。';}catch(e){$('settingsMessage').textContent=e.message;}};
$('modelSelect').onchange=()=>renderEfforts('default');
async function login(accountId){try{$('settingsMessage').textContent='正在打开官方授权页…';const r=await api('auth/start',{accountId});window.location.assign(r.url);}catch(e){$('settingsMessage').textContent=e.message;}}
$('login').onclick=()=>login();$('reconnect').onclick=()=>login(state.auth.active);
$('accounts').onchange=async e=>{if(e.target.id!=='accountSelect')return;try{await api('auth/select',{id:e.target.value});await reload();$('logout').hidden=!chatgptConnected();$('reconnect').hidden=false;if(chatgptConnected())await refreshModels();else{$('modelSelect').innerHTML='<option value="">请重新授权此账户</option>';models=[];renderEfforts();}}catch(e){$('settingsMessage').textContent=e.message;}};
$('logout').onclick=async()=>{try{const r=await api('auth/logout',{});await reload();models=[];$('modelSelect').innerHTML='<option value="">请先连接账户</option>';$('logout').hidden=true;renderEfforts();$('settingsMessage').textContent=r.revoked?'已断开连接。':'已在本地断开，未确认远程撤销；请到 ChatGPT 设置中断开本应用。';}catch(e){$('settingsMessage').textContent=e.message;}};
$('saveSettings').onclick=async()=>{try{const provider=$('providerSelect').value;if(provider==='api'&&($('apiToken').value||$('apiUrl').value.replace(/\/+$/,'')!==state.apiConnection?.baseUrl||$('apiProtocol').value!==state.apiConnection?.protocol))throw new Error('API 连接信息已更改，请先点击「连接并获取模型 ID」');const applyToCurrent=!$('applyEffortLabel').hidden&&$('applyEffort').checked;await api('settings',{gameType:$('modeSelect').value,provider,model:$('modelSelect').value,humanColor:Number(document.querySelector('input[name=color]:checked').value),reasoningEffort:$('effortSelect').value,applyToCurrent});await reload();$('settingsDialog').close();notice(applyToCurrent?'设置已保存，当前棋局从下一次 AI 请求起使用新的思考强度。':'设置已保存，对新棋局生效。');}catch(e){$('settingsMessage').textContent=e.message;}};
$('welcomeClose').onclick=()=>{$('welcomeDialog').close();try{localStorage.setItem('gomoku-welcomed-'+state.auth.active,'1');}catch{}};
try{
  state=await api('state');$('modeSelect').value=state.settings.gameType||'gomoku';game=state.games.find(g=>g.status==='playing')||state.games[0]||null;replay=game?.status==='finished'?game.moves.length:null;render();
  const query=new URLSearchParams(location.search);if(query.get('loginError'))notice(query.get('loginError'));if(query.get('connected')){let welcomed=false;try{welcomed=localStorage.getItem('gomoku-welcomed-'+state.auth.active);}catch{}if(!welcomed)$('welcomeDialog').showModal();else await openSettings();}history.replaceState(null,'','/');
  // A reload during a long AI turn reconnects to the persisted result.
  setInterval(async()=>{if(working||!state.busy)return;try{await reload();}catch{}},2500);
}catch(e){notice(e.message);$('connectionText').textContent='本地服务不可用';}
