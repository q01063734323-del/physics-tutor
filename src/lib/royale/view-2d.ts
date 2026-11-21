import {balance} from './config';
import {loadArt,renderBattle} from './render';
import type {BattleView} from './presentation';
export function create2DView(canvas:HTMLCanvasElement,arena:string,onError:(message:string)=>void):BattleView{
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D недоступен.');
 let cssWidth=1,cssHeight=1,pixelRatio=1,low=false;const size=()=>{const ratio=low?1:pixelRatio;canvas.width=Math.max(1,Math.round(cssWidth*ratio));canvas.height=Math.max(1,Math.round(cssHeight*ratio));};
 const assets=loadArt(()=>{if(assets.failed.length)onError('Часть графики не загрузилась. Проверьте соединение.');});
 return {
 resize(width,height,dpr){cssWidth=width;cssHeight=height;pixelRatio=dpr;size();},
 render(f){if(low!==f.lowQuality){low=f.lowQuality;size();}renderBattle(ctx,f.battle,assets.art,f.selected,f.alpha,f.previous,f.reducedMotion,f.cursor,arena,f.lowQuality);},
 pick(x,y,r){return{x:(x-r.left)/r.width*balance.width,y:(y-r.top)/r.height*balance.height};},
 dispose(){assets.dispose();ctx.clearRect(0,0,canvas.width,canvas.height);}
 };
}
