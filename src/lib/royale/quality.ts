export type GraphicsQuality='auto'|'high'|'medium'|'low';
/** Bounded, allocation-free rolling sample of rendered frames; simulation is separate. */
export class FrameMeter{
 private samples=new Float64Array(120);private index=0;private count=0;private sum=0;
 push(ms:number){if(!Number.isFinite(ms)||ms<=0||ms>250)return;this.sum-=this.samples[this.index];this.samples[this.index]=ms;this.sum+=ms;this.index=(this.index+1)%this.samples.length;this.count=Math.min(this.count+1,this.samples.length);}
 reset(){this.samples.fill(0);this.index=0;this.count=0;this.sum=0;}
 get fps(){return this.sum?Math.round(1000*this.count/this.sum):0;}
 get frameMs(){return this.count?this.sum/this.count:0;}
 get ready(){return this.count>=60;}
 low(mode:GraphicsQuality){return mode==='low'||(mode==='auto'&&this.ready&&this.fps<45);}
}
