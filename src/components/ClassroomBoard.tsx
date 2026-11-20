"use client";
import { useRef } from "react";
import type { Room } from "livekit-client";
import type { ClassroomStroke } from "@/lib/classroom";
import { AnnotationCanvas } from "./drawing/AnnotationCanvas";
type BoardProps={label:string;strokes:ClassroomStroke[];accountId:string;canDraw:boolean;canEraseAll?:boolean;onStroke:(stroke:Omit<ClassroomStroke,"author">)=>void;onErase:(id:string)=>void;onUndo:()=>void;onClear?:()=>void;room?:Room|null;peerCanDraw?:boolean};
export function ClassroomBoard(props:BoardProps){const redo=useRef<ClassroomStroke[]>([]);return <AnnotationCanvas {...props} onUndo={()=>{const last=props.strokes.findLast(stroke=>stroke.author===props.accountId);if(last)redo.current.push(last);props.onUndo();}} onRedo={()=>{const stroke=redo.current.pop();if(stroke)props.onStroke({...stroke,id:crypto.randomUUID()});}} onClear={props.canEraseAll?props.onClear:undefined} onStroke={stroke=>{redo.current=[];props.onStroke(stroke);}}/>;}
