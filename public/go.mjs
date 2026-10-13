export const goSize=n=>{const size=n??9;if(![9,13,19].includes(size))throw new Error('围棋请选择 9、13 或 19 路');return size;};
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const hash=b=>b.map(r=>r.join('')).join('/');
export function groupAt(board,x,y){
  const color=board[y]?.[x],stones=[],liberties=new Set(),seen=new Set();if(!color)return {stones,liberties};
  const stack=[[x,y]];while(stack.length){const [a,b]=stack.pop(),key=a+','+b;if(seen.has(key))continue;seen.add(key);stones.push([a,b]);
    for(const [dx,dy] of dirs){const nx=a+dx,ny=b+dy,p=board[ny]?.[nx];if(p===0)liberties.add(nx+','+ny);else if(p===color&&!seen.has(nx+','+ny))stack.push([nx,ny]);}}
  return {stones,liberties};
}
export function placeGo(board,color,m,seen=new Set()){
  const n=board.length;if(!m||!Number.isInteger(m.x)||!Number.isInteger(m.y)||m.x<0||m.x>=n||m.y<0||m.y>=n||board[m.y][m.x])throw new Error('围棋落点不合法');
  const b=board.map(r=>r.slice());b[m.y][m.x]=color;let captured=0;
  for(const [dx,dy] of dirs){const x=m.x+dx,y=m.y+dy;if(b[y]?.[x]!==3-color)continue;const g=groupAt(b,x,y);if(!g.liberties.size)for(const [a,z] of g.stones){b[z][a]=0;captured++;}}
  if(!groupAt(b,m.x,m.y).liberties.size)throw new Error('围棋不能自杀落子');
  if(seen.has(hash(b)))throw new Error('此步造成全局同形，不能立即回提劫');
  return {board:b,captured};
}
export function scoreGo(board,komi=7.5){
  const n=board.length,stones=[0,0,0],territory=[0,0,0],ownership=board.map(r=>r.slice()),seen=new Set();let neutral=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(board[y][x]){stones[board[y][x]]++;continue;}if(seen.has(x+','+y))continue;
    const region=[],borders=new Set(),queue=[[x,y]];
    while(queue.length){const [a,b]=queue.pop(),k=a+','+b;if(seen.has(k))continue;seen.add(k);region.push([a,b]);for(const [dx,dy] of dirs){const nx=a+dx,ny=b+dy,p=board[ny]?.[nx];if(p===0&&!seen.has(nx+','+ny))queue.push([nx,ny]);else if(p)borders.add(p);}}
    const owner=borders.size===1?[...borders][0]:0;if(owner)territory[owner]+=region.length;else neutral+=region.length;for(const [a,b] of region)ownership[b][a]=owner;
  }
  return {black:stones[1]+territory[1],white:stones[2]+territory[2]+komi,komi,stones,territory,neutral,ownership};
}
export function inspectGo(moves,size=9){
  const n=goSize(size);if(!Array.isArray(moves))throw new Error('围棋棋谱格式错误');
  let board=Array.from({length:n},()=>Array(n).fill(0)),passes=0,winner=0,score=null,next=1;const seen=new Set([hash(board)]),captures=[0,0,0];
  for(const m of moves){if(winner)throw new Error('围棋已经结束');if(m?.pass===true)passes++;else{const s=placeGo(board,next,m,seen);board=s.board;captures[next]+=s.captured;seen.add(hash(board));passes=0;}next=3-next;if(passes===2){score=scoreGo(board);winner=score.black>score.white?1:2;}}
  const legalMoves=[];if(!winner){for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!board[y][x])try{placeGo(board,next,{x,y},seen);legalMoves.push({x,y});}catch{}legalMoves.push({pass:true});}
  return {board,next,winner,draw:false,result:winner?'area':null,passes,captures,score,legalMoves};
}
