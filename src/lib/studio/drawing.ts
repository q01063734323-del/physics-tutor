import { isClassroomStroke, type ClassroomStroke } from "../classroom";
export const drawingTopic="physics-drawing-v2";
export type DrawingEvent={type:"stroke:start"|"stroke:point"|"stroke:end"|"stroke:cancel";space:string;seq:number;stroke:Omit<ClassroomStroke,"author">};
export function readDrawingEvent(bytes:Uint8Array):DrawingEvent|null {
  if(bytes.length>14000)return null;
  try{const value=JSON.parse(new TextDecoder().decode(bytes));return value && ["stroke:start","stroke:point","stroke:end","stroke:cancel"].includes(value.type) && typeof value.space==="string" && value.space.length<200 && Number.isInteger(value.seq) && value.seq>=0 && isClassroomStroke(value.stroke)?value:null;}catch{return null;}
}
export const xy=(point:string)=>point.split(",").map(Number) as [number,number];
export function shapePoints(tool:string,start:string,end:string){
  const [x,y]=xy(start),[a,b]=xy(end);const point=(x:number,y:number)=>`${Math.max(0,Math.min(9999,x)).toFixed(1)},${Math.max(0,Math.min(9999,y)).toFixed(1)}`;
  if(tool==="rectangle")return [start,point(a,y),end,point(x,b),start];
  if(tool==="arrow"){const angle=Math.atan2(b-y,a-x),size=Math.min(20,Math.hypot(a-x,b-y)/3);return [start,end,point(a-size*Math.cos(angle-.5),b-size*Math.sin(angle-.5)),end,point(a-size*Math.cos(angle+.5),b-size*Math.sin(angle+.5))];}
  return [start,end];
}
export function smoothStroke(context:CanvasRenderingContext2D,stroke:ClassroomStroke|Omit<ClassroomStroke,"author">){
  const points=stroke.points.map(xy);if(points.length<2)return;
  context.save();context.strokeStyle=stroke.color;context.lineWidth=stroke.width||3;context.lineCap="round";context.lineJoin="round";context.globalAlpha=stroke.tool==="marker"?.28:1;context.beginPath();context.moveTo(...points[0]);
  if(stroke.tool==="line" || stroke.tool==="arrow" || stroke.tool==="rectangle")for(const point of points.slice(1))context.lineTo(...point);
  else {for(let i=1;i<points.length-1;i++)context.quadraticCurveTo(points[i][0],points[i][1],(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2);context.lineTo(...points.at(-1)!);}
  context.stroke();context.restore();
}
export function hitStroke(stroke:ClassroomStroke,point:string){const [x,y]=xy(point);for(let i=1;i<stroke.points.length;i++){const [a,b]=xy(stroke.points[i-1]),[c,d]=xy(stroke.points[i]);const t=Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2||1)));if(Math.hypot(x-a-t*(c-a),y-b-t*(d-b))<Math.max(8,(stroke.width||3)/2))return true;}return false;}
