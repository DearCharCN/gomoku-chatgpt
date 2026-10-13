// Pure rules shared by the browser and server; no move selection or AI search.
export const names={K:'帅',A:'仕',B:'相',N:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'};
export const colorOf=p=>!p?0:p===p.toUpperCase()?1:2;
export const position=(x,y)=>`${String.fromCharCode(65+x)}${10-y}`;
const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<9&&y>=0&&y<10;
const palace=(x,y,c)=>x>=3&&x<=5&&(c===1?y>=7&&y<=9:y>=0&&y<=2);
export function initialBoard(){
  const b=Array.from({length:10},()=>Array(9).fill(''));
  b[0]=[...'rnbakabnr'];b[9]=[...'RNBAKABNR'];
  b[2][1]=b[2][7]='c';b[7][1]=b[7][7]='C';
  for(let x=0;x<9;x+=2){b[3][x]='p';b[6][x]='P';}return b;
}
function screens(b,fx,fy,x,y){let n=0;const dx=Math.sign(x-fx),dy=Math.sign(y-fy);for(let a=fx+dx,z=fy+dy;a!==x||z!==y;a+=dx,z+=dy)if(b[z][a])n++;return n;}
export function pseudoLegal(b,m){
  if(!m||![m.fromX,m.x].every(x=>Number.isInteger(x)&&x>=0&&x<9)||![m.fromY,m.y].every(y=>Number.isInteger(y)&&y>=0&&y<10))return false;
  const {fromX:fx,fromY:fy,x,y}=m,p=b[fy][fx],c=colorOf(p),target=b[y][x],dx=x-fx,dy=y-fy,ax=Math.abs(dx),ay=Math.abs(dy);
  if(!p||(!dx&&!dy)||colorOf(target)===c)return false;
  switch(p.toLowerCase()){
    case 'r':return (!dx||!dy)&&screens(b,fx,fy,x,y)===0;
    case 'c':return (!dx||!dy)&&screens(b,fx,fy,x,y)===(target?1:0);
    case 'n':return (ax===2&&ay===1&&!b[fy][fx+Math.sign(dx)])||(ax===1&&ay===2&&!b[fy+Math.sign(dy)][fx]);
    case 'b':return ax===2&&ay===2&&(c===1?y>=5:y<=4)&&!b[fy+dy/2][fx+dx/2];
    case 'a':return ax===1&&ay===1&&palace(x,y,c);
    case 'k':return (target.toLowerCase()==='k'&&!dx&&screens(b,fx,fy,x,y)===0)||(ax+ay===1&&palace(x,y,c));
    case 'p':return (dx===0&&dy===(c===1?-1:1))||((c===1?fy<=4:fy>=5)&&ay===0&&ax===1);
    default:return false;
  }
}
export function inCheck(b,c){
  let king;for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]===(c===1?'K':'k'))king={x,y};
  if(!king)return true;
  for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(colorOf(b[y][x])===3-c&&pseudoLegal(b,{fromX:x,fromY:y,...king}))return true;
  return false;
}
function moved(b,m){const next=b.map(r=>r.slice());next[m.y][m.x]=next[m.fromY][m.fromX];next[m.fromY][m.fromX]='';return next;}
export function isLegal(b,c,m){return !!m&&inside(m.fromX,m.fromY)&&colorOf(b[m.fromY][m.fromX])===c&&pseudoLegal(b,m)&&b[m.y][m.x].toLowerCase()!=='k'&&!inCheck(moved(b,m),c);}
export function legalMoves(b,c){const moves=[];for(let fy=0;fy<10;fy++)for(let fx=0;fx<9;fx++)if(colorOf(b[fy][fx])===c)for(let y=0;y<10;y++)for(let x=0;x<9;x++){const m={fromX:fx,fromY:fy,x,y};if(isLegal(b,c,m))moves.push(m);}return moves;}
const key=(b,c)=>b.map(r=>r.map(p=>p||'.').join('')).join('/')+':'+c;
export function positionStatus(board,next){const check=inCheck(board,next),moves=legalMoves(board,next);return {check,legalMoves:moves,winner:moves.length?0:3-next,result:moves.length?null:check?'checkmate':'stalemate'};}
export function repetitionResult(indices,checks){
  if(indices.length<3)return null;
  const cycle=checks.slice(indices.at(-3));
  const perpetual=[1,2].filter(c=>{const own=cycle.filter(x=>x.color===c);return own.length>0&&own.every(x=>x.check);});
  return perpetual.length===1?{winner:3-perpetual[0],draw:false,result:'perpetual-check'}:{winner:0,draw:true,result:'repetition'};
}
export function inspectXiangqi(moves){
  if(!Array.isArray(moves))throw new Error('象棋棋谱格式错误');
  let board=initialBoard(),next=1,winner=0,draw=false,result=null,check=false,legal=legalMoves(board,1);
  const seen=new Map([[key(board,1),[0]]]),checks=[];
  for(let i=0;i<moves.length;i++){
    const m=moves[i];if(winner||draw||!isLegal(board,next,m))throw new Error('象棋走法不合法：请检查走子规则，并确保己方将帅安全');
    const color=next;board=moved(board,m);next=3-next;const state=positionStatus(board,next);({check,winner,result}=state);legal=state.legalMoves;checks.push({color,check});
    const hash=key(board,next),indices=seen.get(hash)||[];indices.push(i+1);seen.set(hash,indices);
    if(!winner){const repeat=repetitionResult(indices,checks);if(repeat){({winner,draw,result}=repeat);}}
  }
  return {board,next,winner,draw,result,check,legalMoves:winner||draw?[]:legal};
}
export function moveLabel(m){return `${position(m.fromX,m.fromY)} → ${position(m.x,m.y)}`;}
