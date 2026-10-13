import * as gomoku from './game.mjs';
import {types,typeOf,variantState,moveText,movingType} from '../public/game-types.mjs';
import {goSize} from '../public/go.mjs';
import {holes} from '../public/checkers.mjs';
export const gameType=typeOf;
export function validateGameType(t='gomoku'){if(!Object.hasOwn(types,t))throw new Error('请选择有效棋类');return t;}
export function gameOptions(type,body){return type==='go'?{boardSize:goSize(body.boardSize),komi:7.5}:{};}
export const inspectGame=g=>typeOf(g)==='gomoku'?gomoku.inspect(g.moves):variantState(g);
export function cleanMove(g,m){
  if(typeOf(g)==='go'&&m?.pass===true)return {pass:true};
  const clean={...(movingType(typeOf(g))?{fromX:m?.fromX,fromY:m?.fromY}:{}),x:m?.x,y:m?.y};
  if(typeOf(g)==='checkers'){const found=inspectGame(g).legalMoves.find(a=>a.fromX===clean.fromX&&a.fromY===clean.fromY&&a.x===clean.x&&a.y===clean.y);if(found)clean.path=found.path;}
  return clean;
}
export function appendMove(g,m){
  if(typeOf(g)==='gomoku')return gomoku.append(g,m.x,m.y);
  if(g.status!=='playing')throw new Error('棋局已经结束');
  const move=cleanMove(g,m),moves=[...g.moves,move],s=inspectGame({...g,moves});g.moves=moves;
  if(s.winner||s.draw){g.status='finished';g.winner=s.winner;g.result=s.result;g.finishedAt=new Date().toISOString();if(s.score)g.score=s.score;}return g;
}
export function transcript(g){
  const t=typeOf(g);if(t==='gomoku')return gomoku.transcript(g);const s=inspectGame(g);
  const encodings={xiangqi:'大写红方，小写黑方：K帅/将 A仕/士 B相/象 N马 R车 C炮 P兵/卒，空位为空字符串。',go:'0空位、1黑棋、2白棋。',checkers:'轴向坐标x=q,y=r，键为q,r；0空位、1红方、2蓝方；红方由下方y>4前往上方y<-4。',jungle:'正数红方、负数蓝方、0空位；绝对值等级：1鼠2猫3狗4狼5豹6虎7狮8象。河流y=3..5且x为1,2,4,5；红穴(3,8)、蓝穴(3,0)，陷阱在各穴相邻3格。'};
  return {gameType:t,rules:types[t].rules,pieces:encodings[t],coordinates:t==='checkers'?'使用给定轴向坐标；只允许棋盘holes中的坐标。':'x从左向右、y从上向下，从0开始。',...(t==='go'?{boardSize:g.boardSize||9,komi:7.5,passes:s.passes,captures:s.captures}:{}),...(t==='checkers'?{holes}:{}),humanColor:types[t].colors[g.humanColor-1],next:s.next,result:g.status==='finished'?{winner:g.winner,reason:g.result,score:g.score}:null,moves:g.moves.map((m,i)=>({ply:i+1,color:types[t].colors[i%2],...m,coordinate:moveText(g,m)})),board:s.board,inCheck:s.check,legalMoves:s.legalMoves};
}
export function validateReview(review,g){return gomoku.validateReview(review,g,typeOf(g)!=='gomoku'?(m,prefix)=>{inspectGame({...g,moves:[...prefix,m]});}:undefined);}
