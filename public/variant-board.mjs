import {variantState,typeOf,types,pointText} from './game-types.mjs';
import {holes,pointKey} from './checkers.mjs';
import {animals,jungleColor,water,trap,den} from './jungle.mjs';
export function ownerAt(g,s,x,y){return typeOf(g)==='jungle'?jungleColor(s.board[y]?.[x]):typeOf(g)==='checkers'?s.board[pointKey(x,y)]:s.board[y]?.[x];}
export function drawVariant({game,replay,selected,suggestion,live,numbers}){
  const prefix={...game,moves:game.moves.slice(0,replay??game.moves.length)},s=variantState(prefix),t=typeOf(game),last=prefix.moves.at(-1);
  const target=(x,y)=>selected&&s.legalMoves.some(m=>m.fromX===selected.x&&m.fromY===selected.y&&m.x===x&&m.y===y);
  const picked=(x,y)=>selected?.x===x&&selected?.y===y;
  const cls=(x,y)=>`${picked(x,y)?' picked':''}${target(x,y)?' legal-target':''}${suggestion?.x===x&&suggestion?.y===y?' suggested':''}${suggestion?.fromX===x&&suggestion?.fromY===y?' hint-source':''}`;
  let html='',info='';
  if(t==='go'){
    const n=s.board.length,w=n*30,legal=new Set(s.legalMoves.filter(m=>!m.pass).map(m=>m.x+','+m.y));let svg=`<svg viewBox="0 0 ${w} ${w}" aria-hidden="true">`;
    for(let i=0;i<n;i++){const p=15+i*30;svg+=`<path d="M15 ${p} H${w-15} M${p} 15 V${w-15}" stroke="#8d7b53" stroke-width=".8"/>`;}
    const stars=n===9?[2,4,6]:n===13?[3,6,9]:[3,9,15];for(const x of stars)for(const y of stars)svg+=`<circle cx="${15+x*30}" cy="${15+y*30}" r="2.2" fill="#8d7b53"/>`;
    html=svg+'</svg><div class="axes" aria-hidden="true">';for(let i=0;i<n;i++)html+=`<span class="axis-x" style="left:${(i+.5)/n*100}%">${'ABCDEFGHJKLMNOPQRST'[i]}</span><span class="axis-y" style="top:${(i+.5)/n*100}%">${n-i}</span>`;html+='</div>';
    const indices=new Map(prefix.moves.map((m,i)=>[m.x+','+m.y,i+1]));
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const c=s.board[y][x],recent=!last?.pass&&last?.x===x&&last?.y===y;html+=`<button class="cell${cls(x,y)}" data-x="${x}" data-y="${y}" aria-label="${pointText(game,x,y)}${c?'，'+types.go.colors[c-1]:''}" ${!live||!legal.has(x+','+y)?'disabled':''}>${c?`<span class="stone ${c===1?'black':'white'}${recent?' latest':''}">${numbers?indices.get(x+','+y)||'':''}</span>`:s.score?.ownership[y][x]?`<span class="territory ${s.score.ownership[y][x]===1?'black':'white'}"></span>`:''}</button>`;}
    info=`黑提 ${s.captures[1]} 子 · 白提 ${s.captures[2]} 子 · 白贴 7.5`;
    if(s.score)info=`数子结果：黑 ${s.score.black} · 白 ${s.score.white}（含贴目）· 中立 ${s.score.neutral}。`;
    else if(s.passes)info+=' · 上一手停着，再停一手即按盘面结算';
  }else if(t==='checkers'){
    for(const {x,y} of holes){const c=s.board[pointKey(x,y)],can=target(x,y),label=pointText(game,x,y)+(c?'，'+types.checkers.colors[c-1]:'，空位')+(can?'，可走':'');html+=`<button class="cell hop-hole${y>4?' red-camp':y<-4?' blue-camp':''}${cls(x,y)}" style="left:${(x+y/2+6.8)/13.6*100}%;top:${(y+8.8)/17.6*100}%" data-x="${x}" data-y="${y}" aria-label="${label}" title="${pointText(game,x,y)}" ${!live||(c!==game.humanColor&&!can)?'disabled':''}>${c?`<span class="marble ${c===1?'red':'blue'}${last?.x===x&&last?.y===y?' latest':''}"></span>`:''}</button>`;}
    const red=holes.filter(p=>p.y<-4&&s.board[pointKey(p.x,p.y)]===1).length,blue=holes.filter(p=>p.y>4&&s.board[pointKey(p.x,p.y)]===2).length;info=`入营进度：红 ${red}/10 · 蓝 ${blue}/10。可直接点击连续跳跃的最终落点。`;
    if(last?.path?.length>1)info+=` 上一步连续跳 ${last.path.length} 次。`;
  }else{
    for(let y=0;y<9;y++)for(let x=0;x<7;x++){const p=s.board[y][x],c=jungleColor(p),rank=Math.abs(p),can=target(x,y),terrain=water(x,y)?'河流':den(x,y)?'兽穴':trap(x,y)?'陷阱':'陆地',owner=den(x,y)||trap(x,y);
      html+=`<button class="cell jungle-cell ${water(x,y)?'river':owner?'home-'+owner:'land'}${cls(x,y)}" data-x="${x}" data-y="${y}" aria-label="${pointText(game,x,y)}，${p?types.jungle.colors[c-1]+animals[rank]+rank+'级':terrain}${can?'，可走':''}" ${!live||(c!==game.humanColor&&!can)?'disabled':''}>${p?`<span class="beast ${c===1?'red':'blue'}${last?.x===x&&last?.y===y?' latest':''}"><b>${animals[rank]}</b><small>${rank}</small></span>`:`<span class="terrain">${den(x,y)?'⌂<small>兽穴</small>':trap(x,y)?'✧<small>陷阱</small>':water(x,y)?'≈':''}</span>`}</button>`;}
    info='等级：象8 > 狮7 > 虎6 > 豹5 > 狼4 > 狗3 > 猫2 > 鼠1；鼠可吃象。';
  }
  return {html,info,state:s};
}
