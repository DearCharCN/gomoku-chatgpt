import * as gomoku from './game.mjs';
import {inspectXiangqi,moveLabel} from '../public/xiangqi.mjs';
export const gameType=g=>g.gameType||'gomoku';
export function validateGameType(t='gomoku'){if(!['gomoku','xiangqi'].includes(t))throw new Error('请选择五子棋或中国象棋');return t;}
export const inspectGame=g=>gameType(g)==='xiangqi'?inspectXiangqi(g.moves):gomoku.inspect(g.moves);
export function appendMove(g,m){
  if(gameType(g)!=='xiangqi')return gomoku.append(g,m.x,m.y);
  if(g.status!=='playing')throw new Error('棋局已经结束');
  const move={fromX:m.fromX,fromY:m.fromY,x:m.x,y:m.y},moves=[...g.moves,move],s=inspectXiangqi(moves);g.moves=moves;
  if(s.winner||s.draw){g.status='finished';g.winner=s.winner;g.result=s.result;g.finishedAt=new Date().toISOString();}return g;
}
export function transcript(g){
  if(gameType(g)!=='xiangqi')return gomoku.transcript(g);
  const s=inspectXiangqi(g.moves);
  return {gameType:'xiangqi',rules:'中国象棋休闲规则。红先黑后；遵守蹩马腿、塞象眼、炮隔子吃子、九宫、过河兵与将帅不能照面。不能走入被将军局面，将死或困毙均判负。三次重复局面：单方连续将军者负，否则和棋；不裁定长捉。坐标x=0..8从左向右，y=0..9从上向下；红方在下，A10左上，I1右下。',pieces:'大写红方，小写黑方：K帅/将 A仕/士 B相/象 N马 R车 C炮 P兵/卒，空格用空字符串。',humanColor:g.humanColor===1?'red':'black',result:g.status==='finished'?{winner:g.winner,reason:g.result}:null,moves:g.moves.map((m,i)=>({ply:i+1,color:i%2?'black':'red',...m,coordinate:moveLabel(m)})),board:s.board,inCheck:s.check,legalMoves:s.legalMoves};
}
export function validateReview(review,g){return gomoku.validateReview(review,g,gameType(g)==='xiangqi'?(m,prefix)=>{inspectXiangqi([...prefix,m]);}:undefined);}
