export const SIZE = 15;
export function position(x,y) { return `${String.fromCharCode(65+x)}${15-y}`; }
export function inspect(moves) {
  if (!Array.isArray(moves) || moves.length>225) throw new Error('棋谱格式错误');
  const board=Array.from({length:15},()=>Array(15).fill(0));
  let winner=0, line=[];
  for (let i=0;i<moves.length;i++) {
    const {x,y}=moves[i], color=i%2+1;
    if(winner || !Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=15||y<0||y>=15||board[y][x]) throw new Error('落子不合法');
    board[y][x]=color;
    for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
      const chain=[{x,y}];
      for(const sign of [-1,1]) for(let n=1;n<15;n++) {
        const a=x+sign*n*dx,b=y+sign*n*dy;
        if(board[b]?.[a]!==color) break;
        chain.push({x:a,y:b});
      }
      if(chain.length>=5) {winner=color;line=chain;}
    }
  }
  return {board,winner,line,draw:!winner&&moves.length===225,next:moves.length%2+1};
}
export function append(game,x,y) {
  if(game.status!=='playing') throw new Error('棋局已经结束');
  const next=[...game.moves,{x,y}]; const state=inspect(next);
  game.moves=next;
  if(state.winner||state.draw) {game.status='finished';game.winner=state.winner;game.result=state.draw?'draw':'five';game.finishedAt=new Date().toISOString();}
  return game;
}
export function transcript(game) {
  const state=inspect(game.moves);
  return {rules:'15×15 自由五子棋；无禁手，连成五子或以上获胜。坐标 A1–O15，A15 为左上角。',humanColor:game.humanColor===1?'black':'white',result:game.status==='finished'?{winner:game.winner,reason:game.result}:null,moves:game.moves.map((m,i)=>({ply:i+1,color:i%2?'white':'black',...m,coordinate:position(m.x,m.y)})),board:state.board};
}
export function validateReview(review,game,validateBetter) {
  if(typeof review?.summary!=='string'||!Array.isArray(review.points)||!Array.isArray(review.practice)) throw new Error('复盘返回格式不正确，请重试');
  if(review.firstImprovement!==null && (!Number.isInteger(review.firstImprovement)||review.firstImprovement<1||review.firstImprovement>game.moves.length||(review.firstImprovement-1)%2+1!==game.humanColor)) throw new Error('复盘关键步数不合法，请重试');
  if(review.points.length>6) throw new Error('复盘关键节点过多，请重试');
  let previous=0;
  for(const p of review.points) {
    if(!Number.isInteger(p.ply)||p.ply<1||p.ply>game.moves.length||(p.ply-1)%2+1!==game.humanColor||typeof p.explanation!=='string'||typeof p.title!=='string') throw new Error('复盘步骤不合法，请重试');
    if(p.ply<=previous) throw new Error('复盘步骤顺序不正确，请重试');
    previous=p.ply;
    if(p.betterMove!==null&&validateBetter){validateBetter(p.betterMove,game.moves.slice(0,p.ply-1));}
    else if(p.betterMove!==null) { const b=inspect(game.moves.slice(0,p.ply-1)).board,m=p.betterMove;
      if(!m) throw new Error('复盘替代着法格式不正确');
      if(!Number.isInteger(m.x)||!Number.isInteger(m.y)||m.x<0||m.x>14||m.y<0||m.y>14||b[m.y][m.x]) throw new Error('复盘推荐了非法落点，请重试');
    }
  }
  if((review.points.length?review.points[0].ply:null)!==review.firstImprovement) throw new Error('最早改进步数与复盘节点不一致，请重试');
  if(review.practice.some(p=>typeof p!=='string')) throw new Error('复盘建议格式不正确');
  return review;
}
