export const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
export const holes=[];
for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){const v=[Math.abs(x),Math.abs(y),Math.abs(-x-y)];if(v.every(a=>a<=8)&&v.filter(a=>a<=4).length>=2)holes.push({x,y});}
export const pointKey=(x,y)=>`${x},${y}`;
const valid=new Set(holes.map(p=>pointKey(p.x,p.y)));
export const goal=(p,c)=>c===1?p.y<-4:p.y>4;
export function initialCheckers(){return Object.fromEntries(holes.map(p=>[pointKey(p.x,p.y),p.y>4?1:p.y<-4?2:0]));}
export function checkerMoves(board,color){
  const moves=[];
  for(const p of holes){const start=pointKey(p.x,p.y);if(board[start]!==color)continue;const inGoal=goal(p,color),seen=new Set([start]),queue=[{...p,path:[]}];
    const allowed=(x,y)=>valid.has(pointKey(x,y))&&!board[pointKey(x,y)]&&(!inGoal||goal({x,y},color));
    for(const [dx,dy] of directions){const x=p.x+dx,y=p.y+dy;if(allowed(x,y))moves.push({fromX:p.x,fromY:p.y,x,y,path:[{x,y}]});}
    // A breadth-first traversal finds a valid shortest hop path for every endpoint.
    while(queue.length){const cur=queue.shift();for(const [dx,dy] of directions){const mid=pointKey(cur.x+dx,cur.y+dy),x=cur.x+2*dx,y=cur.y+2*dy,k=pointKey(x,y);
      if(mid===start||!board[mid]||seen.has(k)||!allowed(x,y)||((inGoal||goal(cur,color))&&!goal({x,y},color)))continue;
      seen.add(k);const path=[...cur.path,{x,y}];queue.push({x,y,path});moves.push({fromX:p.x,fromY:p.y,x,y,path});}}
  }
  return moves;
}
export function checkerWinner(board){for(const c of [1,2])if(holes.filter(p=>goal(p,c)).every(p=>board[pointKey(p.x,p.y)]===c))return c;return 0;}
export const sameMove=(a,b)=>a?.fromX===b?.fromX&&a?.fromY===b?.fromY&&a?.x===b?.x&&a?.y===b?.y;
export function inspectCheckers(moves){
  if(!Array.isArray(moves))throw new Error('跳棋棋谱格式错误');let board=initialCheckers(),next=1,winner=0,draw=false,result=null,legalMoves=checkerMoves(board,1);const keys=new Map();
  const remember=()=>{const k=holes.map(p=>board[pointKey(p.x,p.y)]).join('')+next;keys.set(k,(keys.get(k)||0)+1);return keys.get(k);};remember();
  for(const m of moves){if(winner||draw)throw new Error('跳棋已经结束');if(!legalMoves.some(a=>sameMove(a,m)))throw new Error('跳棋走法不合法，请选择相邻空位或可连续跳达的位置');
    board={...board,[pointKey(m.fromX,m.fromY)]:0,[pointKey(m.x,m.y)]:next};winner=checkerWinner(board);next=3-next;legalMoves=winner?[]:checkerMoves(board,next);
    if(winner)result='camp';else if(remember()>=3){draw=true;result='repetition';legalMoves=[];}else if(!legalMoves.length){winner=3-next;result='blocked';}
  }
  return {board,next,winner,draw,result,legalMoves};
}
