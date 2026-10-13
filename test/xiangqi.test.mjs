import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBoard,isLegal,pseudoLegal,inCheck,legalMoves,inspectXiangqi,positionStatus,repetitionResult} from '../public/xiangqi.mjs';
import {appendMove,transcript,validateReview,inspectGame} from '../lib/games.mjs';
const move=(fromX,fromY,x,y)=>({fromX,fromY,x,y});
const empty=()=>Array.from({length:10},()=>Array(9).fill(''));
test('象棋开局有32子、44种红方合法走法，红先黑后并兼容旧五子棋',()=>{
 const s=inspectXiangqi([]);assert.equal(s.board.flat().filter(Boolean).length,32);assert.equal(s.legalMoves.length,44);assert.equal(s.next,1);
 const game={gameType:'xiangqi',humanColor:1,moves:[],status:'playing'};appendMove(game,move(1,7,4,7));assert.equal(inspectGame(game).next,2);assert.equal(transcript(game).gameType,'xiangqi');assert.ok(transcript(game).legalMoves.length);
 assert.throws(()=>appendMove(game,move(0,6,0,5)));assert.equal(game.moves.length,1);
 assert.equal(inspectGame({moves:[]}).board.length,15);
});
test('马腿、象眼与象不过河',()=>{
 const b=initialBoard();assert.ok(isLegal(b,1,move(1,9,2,7)));b[8][1]='P';assert.ok(!isLegal(b,1,move(1,9,2,7)));
 assert.ok(pseudoLegal(b,move(2,9,4,7)));b[8][3]='P';assert.ok(!pseudoLegal(b,move(2,9,4,7)));
 const river=empty();river[5][2]='B';assert.ok(!pseudoLegal(river,move(2,5,4,3)));river[4][2]='b';assert.ok(!pseudoLegal(river,move(2,4,4,6)));
});
test('车直走不越子，炮只隔一个炮架吃子',()=>{
 const b=empty();b[5][0]='R';b[5][3]='p';assert.ok(pseudoLegal(b,move(0,5,3,5)));assert.ok(!pseudoLegal(b,move(0,5,4,5)));assert.ok(!pseudoLegal(b,move(0,5,1,4)));
 b[5][0]='C';assert.ok(!pseudoLegal(b,move(0,5,3,5)));b[5][1]='P';assert.ok(pseudoLegal(b,move(0,5,3,5)));assert.ok(!pseudoLegal(b,move(0,5,2,5)));b[5][2]='p';assert.ok(!pseudoLegal(b,move(0,5,3,5)));
});
test('将仕限九宫，兵卒过河后可横走但不可后退',()=>{
 const b=empty();b[9][4]='K';b[9][3]='A';assert.ok(pseudoLegal(b,move(4,9,4,8)));assert.ok(!pseudoLegal(b,move(4,9,4,7)));assert.ok(pseudoLegal(b,move(3,9,4,8)));assert.ok(!pseudoLegal(b,move(3,9,2,8)));
 b[6][0]='P';assert.ok(pseudoLegal(b,move(0,6,0,5)));assert.ok(!pseudoLegal(b,move(0,6,1,6)));b[4][0]='P';assert.ok(pseudoLegal(b,move(0,4,1,4)));assert.ok(!pseudoLegal(b,move(0,4,0,5)));
 b[5][8]='p';assert.ok(pseudoLegal(b,move(8,5,7,5)));assert.ok(pseudoLegal(b,move(8,5,8,6)));assert.ok(!pseudoLegal(b,move(8,5,8,4)));
});
test('不能将帅照面、走入将军或忽略将军；吃将不是合法走法',()=>{
 const b=empty();b[0][4]='k';b[9][4]='K';b[5][4]='R';assert.ok(!isLegal(b,1,move(4,5,5,5)));assert.ok(!isLegal(b,1,move(4,5,4,0)));assert.ok(isLegal(b,1,move(4,5,4,4)));
 b[5][4]='P';b[9][0]='r';assert.ok(inCheck(b,1));assert.ok(!isLegal(b,1,move(4,5,4,4)));assert.ok(isLegal(b,1,move(4,9,4,8)));
 assert.ok(!isLegal(b,1,move(-1,0,0,0)));assert.ok(!isLegal(b,1,{x:1,y:1}));
});
test('将死和困毙都判负，不把困毙判为和棋',()=>{
 const b=empty();b[0][4]='k';b[9][4]='K';b[5][4]='P';b[1][3]=b[1][5]='R';
 assert.equal(positionStatus(b,2).result,'stalemate');assert.equal(positionStatus(b,2).winner,1);assert.equal(inCheck(b,2),false);
 b[1][4]='R';assert.equal(positionStatus(b,2).result,'checkmate');assert.equal(positionStatus(b,2).winner,1);
});
test('三次重复和棋、单方长将判负，终局后禁止继续棋谱',()=>{
 const cycle=[move(1,9,2,7),move(1,0,2,2),move(2,7,1,9),move(2,2,1,0)],s=inspectXiangqi([...cycle,...cycle]);assert.equal(s.draw,true);assert.equal(s.result,'repetition');assert.throws(()=>inspectXiangqi([...cycle,...cycle,cycle[0]]));
 const checks=Array.from({length:8},(_,i)=>({color:i%2+1,check:i%2===0}));assert.deepEqual(repetitionResult([0,4,8],checks),{winner:2,draw:false,result:'perpetual-check'});
 assert.equal(repetitionResult([0,4],checks),null);
});
test('象棋复盘校验起终点，拒绝非法推荐且保留完整棋谱',()=>{
 const g={gameType:'xiangqi',humanColor:1,moves:[move(1,7,4,7),move(1,0,2,2)]};
 const r={summary:'测试',firstImprovement:1,points:[{ply:1,title:'出马',explanation:'测试',betterMove:move(1,9,2,7)}],practice:[]};assert.equal(validateReview(r,g),r);
 r.points[0].betterMove=move(1,9,1,7);assert.throws(()=>validateReview(r,g));r.points[0].betterMove={x:2,y:7};assert.throws(()=>validateReview(r,g));assert.equal(transcript(g).moves.length,2);
});
