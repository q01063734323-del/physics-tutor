export class RoyaleSound{
 private context:AudioContext|null=null;private timer:ReturnType<typeof setInterval>|null=null;private last=0;muted=true;volume=.25;music=0;
 unlock(){if(this.muted)return;try{this.context??=new AudioContext();void this.context.resume().catch(()=>undefined);}catch{/* The game works without Web Audio. */}}
 async interfaceCue(kind:'menu'|'select'){
  if(this.muted)return;
  this.unlock();
  await this.context?.resume().catch(()=>undefined);
  this.play(kind);
 }
 play(kind:'hit'|'spawn'|'collapse'|'fire'|'correct'|'wrong'|'win'|'loss'|'select'|'start'|'menu'){
  const ctx=this.context;
  if(this.muted||!ctx||ctx.state!=='running'||this.volume<=0)return;
  const now=ctx.currentTime;
  if(now-this.last<.035&&['hit','spawn'].includes(kind))return;
  this.last=now;
  const chords:Partial<Record<typeof kind,number[]>>={
   correct:[587.33,739.99,880],win:[392,523.25,659.25,783.99],start:[261.63,392,523.25],menu:[369.99,554.37],
  };
  const frequencies=chords[kind]??[{hit:170,spawn:390,collapse:85,fire:120,wrong:150,loss:180,select:334}[kind as 'hit'|'spawn'|'collapse'|'fire'|'wrong'|'loss'|'select']];
  frequencies.forEach((frequency,index)=>{
   const start=now+index*.061;
   const length=kind==='win'?.37:kind==='correct'?.24:.16;
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();
   oscillator.type=kind==='collapse'||kind==='fire'?'triangle':'sine';
   oscillator.frequency.setValueAtTime(frequency,start);
   if(!chords[kind])oscillator.frequency.exponentialRampToValueAtTime(frequency*.64,start+length*.70);
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.exponentialRampToValueAtTime(Math.max(.0002,this.volume*(index===0?.15:.105)),start+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,start+length);
   oscillator.connect(gain);gain.connect(ctx.destination);
   oscillator.start(start);oscillator.stop(start+length+.012);
  });
 }
 startMusic(){if(this.timer||this.muted||this.music<=0)return;let note=0;const melody=[220,277.18,329.63,277.18,246.94,329.63,369.99,329.63];this.timer=setInterval(()=>{if(!this.context||this.muted||this.music<=0)return;const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.value=melody[note++%melody.length];g.gain.setValueAtTime(this.volume*this.music*.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.7);o.connect(g);g.connect(this.context.destination);o.start(t);o.stop(t+.75);},650);}
 stopMusic(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 dispose(){this.stopMusic();void this.context?.close().catch(()=>undefined);this.context=null;}
}
