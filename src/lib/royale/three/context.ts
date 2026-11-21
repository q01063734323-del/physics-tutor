/** Context loss affects presentation only. The caller retains the current simulation. */
export function watchContextLoss(target:Pick<EventTarget,'addEventListener'|'removeEventListener'>,onLost:()=>void){
 let alive=true;
 const lost=(event:Event)=>{event.preventDefault();if(alive)onLost();};
 target.addEventListener('webglcontextlost',lost);
 return()=>{alive=false;target.removeEventListener('webglcontextlost',lost);};
}
