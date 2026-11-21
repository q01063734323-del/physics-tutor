import{balance}from'./config';
type ClockDraft={tick:number;savedAt:number;focusRemaining:number;questionFocus:number;focusActive:boolean;forfeit?:boolean};
/** Closing the tab consumes real time; the question budget never becomes an unlimited pause. */
export function resumeTiming(draft:ClockDraft,scale:number,now:number){
 if(!Number.isInteger(draft.tick)||draft.tick<0||draft.tick>balance.matchSeconds*1000/balance.tickMs||!Number.isFinite(draft.savedAt))throw Error('Повреждена запись времени боя.');
 const remaining=Math.max(0,Math.min(balance.focusBudgetSeconds,Number(draft.focusRemaining)||0)),question=Math.max(0,Math.min(balance.focusPerQuestionSeconds,Number(draft.questionFocus)||0));
 if(draft.forfeit)return{tick:draft.tick,focusRemaining:remaining,questionFocus:question};
 const elapsed=Math.max(0,now-draft.savedAt),slowed=draft.focusActive?Math.min(elapsed,remaining*1000,(balance.focusPerQuestionSeconds-question)*1000):0;
 return{tick:Math.min(balance.matchSeconds*1000/balance.tickMs,draft.tick+Math.floor((elapsed-slowed+slowed*Math.max(.15,Math.min(1,scale)))/balance.tickMs)),focusRemaining:remaining-slowed/1000,questionFocus:question+slowed/1000};
}
