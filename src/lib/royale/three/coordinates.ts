import {balance} from '../config';
export const WORLD_SCALE=.05;
/** X -> X, simulation Y -> Z. World Y is presentation height only. */
export function gameToWorld(x:number,y:number,height=0){return{x:(x-balance.width/2)*WORLD_SCALE,y:height,z:(y-balance.height/2)*WORLD_SCALE};}
export function worldToGame(x:number,z:number){return{x:x/WORLD_SCALE+balance.width/2,y:z/WORLD_SCALE+balance.height/2};}
export const arenaWorld={width:balance.width*WORLD_SCALE,depth:balance.height*WORLD_SCALE,riverWidth:(balance.riverBottom-balance.riverTop)*WORLD_SCALE,bridgeCenters:balance.bridges.map(x=>(x-balance.width/2)*WORLD_SCALE),bridgeWidth:balance.bridgeHalf*2*WORLD_SCALE};
