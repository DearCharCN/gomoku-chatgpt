import {inspectXiangqi,names,colorOf,position} from './xiangqi.mjs';
export function drawXiangqi({game,replay,suggestion,selected,live}){
  const shown=(game?.moves||[]).slice(0,replay??game?.moves.length??0),s=inspectXiangqi(shown),last=shown.at(-1);
  let html='<svg viewBox="0 0 450 500" aria-hidden="true">';
  for(let i=0;i<10;i++)html+=`<path d="M25 ${25+i*50} H425"/>`;
  for(let i=0;i<9;i++){const x=25+i*50;html+=`<path d="M${x} 25 V225 M${x} 275 V475"/>`;}
  html+='<path d="M25 225 V275 M425 225 V275 M175 25 L275 125 M275 25 L175 125 M175 375 L275 475 M275 375 L175 475"/><text x="95" y="258">楚 河</text><text x="290" y="258">汉 界</text></svg><div class="axes" aria-hidden="true">';
  for(let x=0;x<9;x++)html+=`<span class="axis-x" style="left:${(x+.5)/9*100}%">${String.fromCharCode(65+x)}</span>`;
  for(let y=0;y<10;y++)html+=`<span class="axis-y" style="top:${(y+.5)/10*100}%">${10-y}</span>`;
  html+='</div>';
  for(let y=0;y<10;y++)for(let x=0;x<9;x++){
    const p=s.board[y][x],own=colorOf(p)===game?.humanColor,picked=selected?.x===x&&selected?.y===y;
    const target=selected&&s.legalMoves.some(m=>m.fromX===selected.x&&m.fromY===selected.y&&m.x===x&&m.y===y);
    const hint=suggestion?.x===x&&suggestion?.y===y,source=suggestion?.fromX===x&&suggestion?.fromY===y;
    const latest=last?.x===x&&last?.y===y,checked=p?.toLowerCase()==='k'&&colorOf(p)===s.next&&s.check;
    const label=position(x,y)+(p?'，'+(colorOf(p)===1?'红':'黑')+names[p]:'，空位')+(picked?'，已选中':'')+(target?'，可走':'');
    html+=`<button class="cell${picked?' picked':''}${target?' legal-target':''}${hint?' suggested':''}${source?' hint-source':''}" data-x="${x}" data-y="${y}" aria-label="${label}" ${!live||(!own&&!target)?'disabled':''}>${p?`<span class="chess-piece ${colorOf(p)===1?'red':'black'}${latest?' latest':''}${checked?' in-check':''}">${names[p]}</span>`:''}</button>`;
  }
  return {html,check:s.check};
}
