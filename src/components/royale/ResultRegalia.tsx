import {useId} from 'react';

export function ResultRegalia({win}:{win:boolean}){
 const id=useId();
 const fill=(name:string)=>`url(#${id}-${name})`;
 return <svg viewBox="0 0 820 246" aria-hidden="true">
  <defs>
   <linearGradient id={id+'-metal'} x2=".2" y2="1"><stop stopColor="#fff9d8"/><stop offset=".26" stopColor="#efc26a"/><stop offset=".49" stopColor="#976025"/><stop offset=".67" stopColor="#ffe39d"/><stop offset="1" stopColor="#653314"/></linearGradient>
   <linearGradient id={id+'-cloth'} x2="0" y2="1"><stop stopColor={win?'#8d55bd':'#a44e69'}/><stop offset=".38" stopColor={win?'#55247e':'#682742'}/><stop offset=".83" stopColor={win?'#351545':'#3c1834'}/><stop offset="1" stopColor={win?'#6b3d8b':'#774157'}/></linearGradient>
   <linearGradient id={id+'-gem'} x2=".4" y2="1"><stop stopColor={win?'#e6a8ff':'#a27499'}/><stop offset=".49" stopColor={win?'#873ac3':'#693351'}/><stop offset="1" stopColor="#332346"/></linearGradient>
  </defs>
  <g fill={fill('cloth')} stroke={fill('metal')} strokeWidth="5" strokeLinejoin="round">
   <path d="M170 116 22 109l57 49-43 61 151-41Z"/>
   <path d="M650 116 798 109l-57 49 43 61-151-41Z"/>
   <path d="m125 105 63 35-15 64-68-39Zm570 0-63 35 15 64 68-39Z" fill={win?'#33124a':'#3a162c'}/>
  </g>
  <g fill={fill('metal')} stroke="#ffe6a6" strokeWidth="1.1" opacity={win?1:.73}>
   {[1,-1].map(direction=><g key={direction} transform={`translate(410 0) scale(${direction} 1)`}>
    <path d="M65 103 Q127 107 157 19" fill="none" strokeWidth="3"/>
    {[0,1,2,3,4].map(i=><g key={i} transform={`translate(${77+i*18} ${96-i*13}) rotate(${-22-i*10})`}>
     <path d="M0 0Q-13-14-8-39Q11-27 0 0Z"/><path d="M1 0Q16-29 39-24Q29-3 1 0Z"/>
    </g>)}
   </g>)}
  </g>
  <path d="M122 109Q410 71 698 109L674 204Q410 174 146 204Z" fill={fill('cloth')} stroke={fill('metal')} strokeWidth="7" strokeLinejoin="round"/>
  <path d="M134 118Q410 85 686 118M153 191Q410 160 667 191" stroke="#ffdfa0" strokeOpacity=".55" strokeWidth="1.6" fill="none"/>
  <path d="M128 119Q152 146 148 190M693 119Q670 144 674 190" stroke="#170d2c" strokeOpacity=".52" strokeWidth="8" fill="none"/>
  {win?<g stroke="#fff0ab" strokeWidth="2.4" strokeLinejoin="round">
   <path fill={fill('metal')} d="M356 37l25 17 29-44 29 44 25-17-11 49q-43-13-86 0Z"/>
   <path fill={fill('metal')} d="M367 77q43-13 86 0l3 14q-46-10-92 0Z"/>
   <path fill={fill('gem')} d="m410 34 13 17-13 17-13-17Z"/>
   <path fill="#ffd280" d="m352 36 5-9 5 9-5 7Zm106 0 5-9 5 9-5 7ZM406 13l4-9 4 9-4 6Z"/>
  </g>:<g strokeLinejoin="round">
   <path fill={fill('metal')} stroke="#f7d7b0" strokeWidth="2" d="m410 10 53 17-10 41q-10 18-43 34-33-16-43-34l-10-41Z"/>
   <path fill={fill('gem')} stroke="#6a3b55" strokeWidth="3" d="m410 19 43 14-9 32q-9 16-34 28-25-12-34-28l-8-32Z"/>
   <path d="m396 24 12 19-5 10 15 11-7 13 6 10m-9-44 13-8 7-13m-10 42 14-6 15 2" fill="none" stroke="#321b31" strokeWidth="3"/>
   <path d="m397 25 12 18-4 9 14 11-7 13 6 10" fill="none" stroke="#d88c9f" strokeWidth="1.2"/>
  </g>}
 </svg>;
}
