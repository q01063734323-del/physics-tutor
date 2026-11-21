import type {TrainerQuestion}from'../trainer-bank';
import type{RoyaleSettings,Tier}from'./config';
export const tierLabels:Record<Tier,string>={easy:'Базовая',medium:'Средняя',hard:'Продвинутая'};
export function suitableTask(question:TrainerQuestion){return Boolean(question.answer&&question.answer.type!=='manual'&&question.review.conditionComplete&&question.review.answerCheckedAgainstSource);}
/** Game classification, not a claim about difficulty assigned by the PDF publisher. */
export function taskTier(question:TrainerQuestion,settings:Pick<RoyaleSettings,'taskTiers'>):Tier{
 const override=settings.taskTiers[question.id];if(override)return override;
 if(question.answer?.type==='sequence'&&question.answer.expected.length>=3)return'hard';
 if(question.answer?.type!=='numeric'||question.prompt.length>700)return'medium';return'easy';
}
export function filterTasks(questions:TrainerQuestion[],settings:RoyaleSettings,{used=[],topics=[],section='all',tier='all'}:{used?:string[];topics?:string[];section?:string;tier?:Tier|'all'}={}){
 const unavailable=new Set([...used,...settings.disabled]);return questions.filter(q=>suitableTask(q)&&!unavailable.has(q.id)&&(section==='all'||q.section===section)&&(!topics.length||q.topics.some(t=>topics.includes(t)))&&(tier==='all'||taskTier(q,settings)===tier));
}
export function normalizeUnitInput(question:TrainerQuestion,input:string){
 const unit=question.answer?.type==='numeric'?question.answer.unit?.trim():null;if(!unit)return input.trim();const normalized=input.trim();
 if(normalized.toLocaleLowerCase('ru').endsWith(unit.toLocaleLowerCase('ru'))){const number=normalized.slice(0,-unit.length).trim();if(/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(number))return number;}
 return normalized;
}
