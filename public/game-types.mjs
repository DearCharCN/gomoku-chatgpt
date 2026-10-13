import {inspectXiangqi} from './xiangqi.mjs';
import {inspectGo,goSize} from './go.mjs';
import {inspectCheckers} from './checkers.mjs';
import {inspectJungle} from './jungle.mjs';
export const types={
  gomoku:{name:'五子棋',colors:['黑棋','白棋'],rules:'15×15 自由五子棋：五子或以上连线获胜，无禁手。'},
  xiangqi:{name:'中国象棋',colors:['红方','黑方'],rules:'象棋休闲规则：将死 / 困毙判负；三次重复时单方长将判负，否则和棋，不裁定长捉。'},
  go:{name:'围棋',colors:['黑棋','白棋'],rules:'简明数子规则：禁自杀、全局同形禁着；双停按盘面数子，白贴7.5。死子须在停着前提净，不自动判死活。'},
  checkers:{name:'中国跳棋',colors:['红方','蓝方'],rules:'双人跳棋：邻移或连续短跳，不吃子；先将10子全部移入对营获胜，入营不得退出；三次重复和棋。'},
  jungle:{name:'斗兽棋',colors:['红方','蓝方'],rules:'象狮虎豹狼狗猫鼠；鼠克象、象不能吃鼠，狮虎可跳河，双方鼠均可阻跳；敌方陷阱降为0级；入敌穴或对方无棋可走获胜，三次重复和棋。'}
};
export const typeOf=g=>g?.gameType||'gomoku';
export const movingType=t=>['xiangqi','checkers','jungle'].includes(t);
export function variantState(g){switch(typeOf(g)){case 'xiangqi':return inspectXiangqi(g.moves);case 'go':return inspectGo(g.moves,g.boardSize);case 'checkers':return inspectCheckers(g.moves);case 'jungle':return inspectJungle(g.moves);default:throw new Error('未知棋类');}}
export function pointText(g,x,y){const t=typeOf(g);if(t==='checkers')return `(${x},${y})`;const n=t==='go'?goSize(g.boardSize):t==='jungle'?9:t==='xiangqi'?10:15;const letters=t==='go'?'ABCDEFGHJKLMNOPQRST':'ABCDEFGHIJKLMNO';return letters[x]+(n-y);}
export function moveText(g,m){if(m.pass===true)return '停一手';return (movingType(typeOf(g))?pointText(g,m.fromX,m.fromY)+' → ':'')+pointText(g,m.x,m.y);}
