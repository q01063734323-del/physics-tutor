import type{Metadata}from'next';import{RoyaleApp}from'@/components/royale/RoyaleApp';
export const metadata:Metadata={title:'Задачи Physics Royale · преподавателю'};
export default function TeacherRoyalePage(){return<RoyaleApp teacher/>;}
