import test from 'node:test';
import assert from 'node:assert/strict';
import {placeGo,inspectGo,scoreGo,groupAt} from '../public/go.mjs';
import {holes,initialCheckers,checkerMoves,checkerWinner,inspectCheckers,pointKey} from '../public/checkers.mjs';
import {initialJungle,jungleLegal,jungleStatus,inspectJungle} from '../public/jungle.mjs';
import {appendMove,inspectGame,transcript,validateReview,cleanMove,gameOptions} from '../lib/games.mjs';
const empty=(w,h=w)=>Array.from({length:h},()=>Array(w).fill(0));
const move=(fromX,fromY,x,y)=>({fromX,fromY,x,y});
test('围棋提子、整块气与禁自杀；提子后有气可合法落子',()=>{
 const b=empty(5);b[1][1]=2;b[1][0]=b[0][1]=b[1][2]=1;
 const r=placeGo(b,1,{x:1,y:2});assert.equal(r.captured,1);assert.equal(r.board[1][1],0);assert.equal(b[1][1],2);
 b[0][1]=b[1][0]=2;assert.throws(()=>placeGo(b,1,{x:0,y:0}),/自杀/);assert.throws(()=>placeGo(b,1,{x:1,y:1}),/不合法/);
 const chain=empty(5);chain[1][1]=chain[1][2]=1;assert.equal(groupAt(chain,1,1).stones.length,2);assert.equal(groupAt(chain,1,1).liberties.size,6);
});
test('围棋劫与全局同形禁着，棋谱保留提子前后局面',()=>{
 const moves=[[1,2],[2,2],[2,1],[1,3],[3,2],[3,3],[8,8],[2,4],[2,3]].map(([x,y])=>({x,y}));
 const before=inspectGo(moves.slice(0,-1)),after=inspectGo(moves);assert.equal(before.board[2][2],2);assert.equal(after.board[2][2],0);assert.equal(after.captures[1],1);
 assert.throws(()=>inspectGo([...moves,{x:2,y:2}]),/同形/);
});
test('围棋9/13/19路、停着计分和终局保护',()=>{
 for(const n of [9,13,19]){const s=inspectGo([],n);assert.equal(s.board.length,n);assert.equal(s.legalMoves.length,n*n+1);}
 assert.throws(()=>inspectGo([],10));assert.throws(()=>gameOptions('go',{boardSize:'19'}));
 const g={gameType:'go',boardSize:9,moves:[],status:'playing',humanColor:1};appendMove(g,{pass:true});assert.equal(g.status,'playing');appendMove(g,{pass:true});assert.equal(g.status,'finished');assert.equal(g.winner,2);assert.equal(g.score.white,7.5);assert.throws(()=>appendMove(g,{x:4,y:4}));
 assert.equal(inspectGo([{pass:true},{x:4,y:4}]).passes,0);
});
test('围棋数子包含盘上棋子与单色围空，不把混合区域算作领地',()=>{
 const b=empty(3);b[1][1]=1;const score=scoreGo(b);assert.equal(score.black,9);assert.equal(score.white,7.5);assert.equal(score.territory[1],8);
 b[2][2]=2;const mixed=scoreGo(b);assert.equal(mixed.neutral,7);assert.equal(mixed.black,1);assert.equal(mixed.white,8.5);
});
test('跳棋121孔、双营各10子，合法走棋不吃子',()=>{
 assert.equal(holes.length,121);const b=initialCheckers();assert.equal(Object.values(b).filter(c=>c===1).length,10);assert.equal(Object.values(b).filter(c=>c===2).length,10);
 const m=checkerMoves(b,1)[0],s=inspectCheckers([m]);assert.equal(Object.values(s.board).filter(Boolean).length,20);assert.equal(s.next,2);assert.throws(()=>inspectCheckers([{...m,x:100}]));
});
test('跳棋连续短跳、不可跳空或越过多格，入目标营后不能退出',()=>{
 const b=Object.fromEntries(holes.map(p=>[pointKey(p.x,p.y),0]));b['0,0']=1;b['1,0']=2;b['3,0']=1;
 const moves=checkerMoves(b,1).filter(m=>m.fromX===0&&m.fromY===0);const chain=moves.find(m=>m.x===4&&m.y===0);assert.equal(chain.path.length,2);assert.ok(!moves.some(m=>m.x===3&&m.y===0));assert.ok(!moves.some(m=>m.x===0&&m.y===2));
 b['1,-5']=1;assert.ok(checkerMoves(b,1).filter(m=>m.fromX===1&&m.fromY===-5).every(m=>m.y<-4));
});
test('跳棋胜利与第三次重复局面和棋，和棋不再允许走棋',()=>{
 const b=initialCheckers();for(const p of holes)b[pointKey(p.x,p.y)]=p.y<-4?1:p.y>4?2:0;assert.equal(checkerWinner(b),1);
 const cycle=[move(-1,5,-1,4),move(1,-5,1,-4),move(-1,4,-1,5),move(1,-4,1,-5)];const s=inspectCheckers([...cycle,...cycle]);assert.equal(s.draw,true);assert.equal(s.winner,0);assert.throws(()=>inspectCheckers([...cycle,...cycle,cycle[0]]));
});
test('斗兽棋开局、等级吃子、鼠象相克和岸边限制',()=>{
 assert.equal(initialJungle().flat().filter(Boolean).length,16);const b=empty(7,9);b[2][0]=1;b[2][1]=-8;assert.ok(jungleLegal(b,1,move(0,2,1,2)));assert.ok(!jungleLegal(b,2,move(1,2,0,2)));
 b[2][0]=3;b[2][1]=-4;assert.ok(!jungleLegal(b,1,move(0,2,1,2)));b[2][0]=5;assert.ok(jungleLegal(b,1,move(0,2,1,2)));
 b[2][1]=0;b[3][1]=1;b[2][1]=-8;assert.ok(!jungleLegal(b,1,move(1,3,1,2)));b[2][1]=-1;assert.ok(!jungleLegal(b,1,move(1,3,1,2)));b[3][2]=-1;assert.ok(jungleLegal(b,1,move(1,3,2,3)));
});
test('斗兽棋仅鼠入水，狮虎跳河会被任一方鼠阻挡',()=>{
 const b=empty(7,9);b[3][0]=6;assert.ok(jungleLegal(b,1,move(0,3,3,3)));assert.ok(!jungleLegal(b,1,move(0,3,1,3)));b[3][1]=1;assert.ok(!jungleLegal(b,1,move(0,3,3,3)));b[3][1]=-1;assert.ok(!jungleLegal(b,1,move(0,3,3,3)));
 b[3][1]=0;b[3][3]=-7;assert.ok(!jungleLegal(b,1,move(0,3,3,3)));b[3][0]=7;assert.ok(jungleLegal(b,1,move(0,3,3,3)));b[3][3]=0;b[3][0]=1;assert.ok(jungleLegal(b,1,move(0,3,1,3)));
});
test('斗兽棋陷阱降级、离开后恢复、不能进己穴、进入敌穴获胜',()=>{
 const b=empty(7,9);b[7][2]=1;b[8][2]=-8;assert.ok(jungleLegal(b,1,move(2,7,2,8)));b[7][2]=8;b[8][2]=-1;assert.ok(jungleLegal(b,1,move(2,7,2,8)));
 b[0][2]=1;b[1][2]=-2;assert.ok(!jungleLegal(b,1,move(2,0,2,1)));b[8][3]=0;b[8][4]=1;assert.ok(!jungleLegal(b,1,move(4,8,3,8)));
 b[0][3]=1;assert.equal(jungleStatus(b,2).winner,1);assert.equal(jungleStatus(b,2).result,'den');
 const alone=empty(7,9);alone[8][0]=8;assert.equal(jungleStatus(alone,2).result,'eliminated');
});
test('斗兽棋三次重复和棋、非法走法拒绝',()=>{
 const cycle=[move(0,8,0,7),move(6,0,6,1),move(0,7,0,8),move(6,1,6,0)];const s=inspectJungle([...cycle,...cycle]);assert.equal(s.draw,true);assert.throws(()=>inspectJungle([{fromX:0,fromY:8,x:1,y:7}]));
});
test('三种新棋类的统一落子、AI上下文与复盘合法性',()=>{
 for(const gameType of ['go','checkers','jungle']){
  const g={gameType,boardSize:9,humanColor:1,moves:[],status:'playing'},legal=inspectGame(g).legalMoves[0];appendMove(g,legal);assert.equal(g.moves.length,1);assert.equal(transcript(g).gameType,gameType);assert.equal(transcript(g).moves.length,1);
  const review={summary:'测试',firstImprovement:1,points:[{ply:1,title:'测试',explanation:'测试',betterMove:legal}],practice:[]};assert.equal(validateReview(review,g),review);review.points[0].betterMove={x:99,y:99};assert.throws(()=>validateReview(review,g));
 }
 const g={gameType:'go',moves:[],boardSize:9};assert.deepEqual(cleanMove(g,{pass:true,x:1,y:2,extra:'ignored'}),{pass:true});
});
