export const animals=['','鼠','猫','狗','狼','豹','虎','狮','象'];
export const jungleColor=p=>p>0?1:p<0?2:0;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]],inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<7&&y>=0&&y<9;
export const water=(x,y)=>y>=3&&y<=5&&[1,2,4,5].includes(x);
export const den=(x,y)=>x===3?(y===8?1:y===0?2:0):0;
export const trap=(x,y)=>(y===8&&[2,4].includes(x)||y===7&&x===3)?1:(y===0&&[2,4].includes(x)||y===1&&x===3)?2:0;
export function initialJungle(){const b=Array.from({length:9},()=>Array(7).fill(0));for(const [x,y,p] of [[0,8,6],[6,8,7],[1,7,2],[5,7,3],[0,6,8],[2,6,4],[4,6,5],[6,6,1]]){b[y][x]=p;b[8-y][6-x]=-p;}return b;}
export function jungleLegal(board,c,m){
  if(!m||!inside(m.fromX,m.fromY)||!inside(m.x,m.y))return false;
  const {fromX:fx,fromY:fy,x,y}=m,p=board[fy][fx],rank=Math.abs(p),target=board[y][x];if(jungleColor(p)!==c||jungleColor(target)===c||den(x,y)===c)return false;
  const dx=x-fx,dy=y-fy;if(!dx&&!dy||dx&&dy)return false;
  if(Math.abs(dx)+Math.abs(dy)!==1){
    if(![6,7].includes(rank)||water(fx,fy)||water(x,y))return false;
    for(let a=fx+Math.sign(dx),b=fy+Math.sign(dy);a!==x||b!==y;a+=Math.sign(dx),b+=Math.sign(dy))if(!water(a,b)||board[b][a])return false;
  }
  if(water(x,y)&&rank!==1)return false;
  if(!target)return true;
  if(water(fx,fy)!==water(x,y))return false;
  const attack=trap(fx,fy)===3-c?0:rank,defend=trap(x,y)===c?0:Math.abs(target);
  if(defend===0)return true;if(attack===0)return false;
  if(attack===8&&defend===1)return false;if(attack===1&&defend===8)return true;return attack>=defend;
}
export function jungleMoves(board,c){const moves=[];for(let fy=0;fy<9;fy++)for(let fx=0;fx<7;fx++)if(jungleColor(board[fy][fx])===c)for(const [dx,dy] of dirs){let x=fx+dx,y=fy+dy;if([6,7].includes(Math.abs(board[fy][fx]))&&water(x,y))while(water(x,y)){x+=dx;y+=dy;}const m={fromX:fx,fromY:fy,x,y};if(jungleLegal(board,c,m))moves.push(m);}return moves;}
export function jungleStatus(board,next){const legalMoves=jungleMoves(board,next);let winner=jungleColor(board[0][3])===1?1:jungleColor(board[8][3])===2?2:0;let result=winner?'den':null;if(!winner&&!legalMoves.length){winner=3-next;result=board.flat().some(p=>jungleColor(p)===next)?'blocked':'eliminated';}return {winner,result,legalMoves:winner?[]:legalMoves};}
export function inspectJungle(moves){
  if(!Array.isArray(moves))throw new Error('斗兽棋棋谱格式错误');let board=initialJungle(),next=1,winner=0,draw=false,result=null,legalMoves=jungleMoves(board,1);const keys=new Map();
  const remember=()=>{const k=board.flat().join(',')+':'+next;keys.set(k,(keys.get(k)||0)+1);return keys.get(k);};remember();
  for(const m of moves){if(winner||draw)throw new Error('斗兽棋已经结束');if(!jungleLegal(board,next,m))throw new Error('斗兽棋走法不合法，请检查等级、河流、陷阱和兽穴');
    board=board.map(r=>r.slice());board[m.y][m.x]=board[m.fromY][m.fromX];board[m.fromY][m.fromX]=0;next=3-next;({winner,result,legalMoves}=jungleStatus(board,next));if(!winner&&remember()>=3){draw=true;result='repetition';legalMoves=[];}}
  return {board,next,winner,draw,result,legalMoves};
}
