import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect,append,position,validateReview} from '../lib/game.mjs';
const game=()=>({status:'playing',moves:[],humanColor:1});
test('四个方向五连获胜，棋局结束后不能落子',()=>{
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    const g=game();for(let i=0;i<5;i++){append(g,4+i*dx,6+i*dy);if(i<4)append(g,i*2,14);}
    assert.equal(g.winner,1);assert.equal(g.status,'finished');assert.equal(inspect(g.moves).line.length,5);assert.throws(()=>append(g,0,0));
  }
});
test('六子连线同样获胜；不提前把不连通棋子算作获胜',()=>{const g=game();for(const x of [0,1,2,4,5]){append(g,x,0);append(g,x*2,14);}assert.equal(g.status,'playing');append(g,3,0);assert.equal(g.winner,1);});
test('拒绝重复落子、越界、非整数以及在胜负已定后伪造棋谱',()=>{assert.throws(()=>inspect([{x:0,y:0},{x:0,y:0}]));for(const [x,y] of [[-1,0],[15,2],[1.5,2],[0,undefined]])assert.throws(()=>inspect([{x,y}]));assert.equal(position(0,0),'A15');assert.equal(position(14,14),'O1');});
test('满盘未形成五连判和棋',()=>{const colors=[[],[]];for(let y=0;y<15;y++)for(let x=0;x<15;x++)colors[(x+Math.floor(y/2))%2].push({x,y});const g=game();for(let i=0;i<225;i++){const m=colors[i%2].shift();append(g,m.x,m.y);}assert.equal(g.result,'draw');assert.equal(g.winner,0);});
test('复盘只引用人类落子，推荐必须是当时的空位',()=>{const g={...game(),moves:[{x:7,y:7},{x:8,y:8},{x:9,y:9}]};const valid={summary:'测试',firstImprovement:3,practice:['防守'],points:[{ply:3,title:'防守',explanation:'建议',betterMove:{x:6,y:6}}]};assert.equal(validateReview(valid,g),valid);assert.throws(()=>validateReview({...valid,firstImprovement:2},g));assert.throws(()=>validateReview({...valid,points:[{...valid.points[0],betterMove:{x:7,y:7}}]},g));assert.throws(()=>validateReview({...valid,points:[{...valid.points[0],ply:9}]},g));});
