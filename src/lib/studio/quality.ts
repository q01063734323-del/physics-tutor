import { LocalVideoTrack, Track, type Room, type ScreenShareCaptureOptions, type TrackPublishOptions } from "livekit-client";
export type QualityProfile="auto"|"presentation"|"motion";
export const qualityLabels:Record<QualityProfile,string>={auto:"Auto",presentation:"Presentation Quality",motion:"Motion Quality"};
export const cameraCapture={resolution:{width:1280,height:720,frameRate:30},frameRate:30};
export function screenQuality(profile:QualityProfile,webkit=false,saveData=false){
  const fps=profile==="motion"?30:saveData?10:15,width=saveData?1280:profile==="presentation"?2560:1920,height=saveData?720:profile==="presentation"?1440:1080;
  const capture:ScreenShareCaptureOptions={audio:false,contentHint:profile==="motion"?"motion":"detail",selfBrowserSurface:"exclude",video:{displaySurface:"window"},systemAudio:"exclude",...(!webkit?{resolution:{width,height,frameRate:fps}}:{})};
  const publish:TrackPublishOptions={screenShareEncoding:{maxBitrate:saveData?2_000_000:profile==="auto"?4_000_000:6_000_000,maxFramerate:fps},degradationPreference:profile==="motion"?"maintain-framerate":"maintain-resolution"};
  return {capture,publish,width,height,fps};
}
export function webkitScreenCapture(userAgent:string){return /AppleWebKit/.test(userAgent)&&!/(Chrome|Chromium|Edg|OPR)\//.test(userAgent);}
const saveData=()=>Boolean((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData);
export async function enableStudioCamera(room:Room,enabled:boolean,deviceId?:string){
  if(!enabled)return room.localParticipant.setCameraEnabled(false);
  let publication;try{publication=await room.localParticipant.setCameraEnabled(true,{...cameraCapture,...(deviceId?{deviceId}:{})},{videoEncoding:{maxBitrate:1_800_000,maxFramerate:30},degradationPreference:"maintain-framerate"});}
  catch(error){if(!(error instanceof Error) || !["OverconstrainedError","ConstraintNotSatisfiedError","TypeError"].includes(error.name))throw error;publication=await room.localParticipant.setCameraEnabled(true,deviceId?{deviceId}:undefined);}
  const track=publication?.track?.mediaStreamTrack;if(track && "contentHint"in track)try{track.contentHint="motion";}catch{/* A hint is optional. */}return publication;
}
export async function beginScreenShare(room:Room,profile:QualityProfile){
  const settings=screenQuality(profile,webkitScreenCapture(navigator.userAgent),saveData());let publication;
  try{publication=await room.localParticipant.setScreenShareEnabled(true,settings.capture,settings.publish);}
  catch(error){if(!(error instanceof Error) || !["OverconstrainedError","ConstraintNotSatisfiedError","TypeError"].includes(error.name))throw error;publication=await room.localParticipant.setScreenShareEnabled(true,{audio:false,video:true,contentHint:settings.capture.contentHint},settings.publish);}
  const track=publication?.track?.mediaStreamTrack;const actual=track?.getSettings();let capabilities:MediaTrackCapabilities|undefined;try{capabilities=track?.getCapabilities?.();}catch{/* Safari may not expose capture capabilities. */}
  return {actual,capabilities,target:settings};
}
export async function updateScreenQuality(room:Room,profile:QualityProfile){
  const publication=room.localParticipant.getTrackPublication(Track.Source.ScreenShare);const video=publication?.track;if(!(video instanceof LocalVideoTrack))return;
  const settings=screenQuality(profile,webkitScreenCapture(navigator.userAgent),saveData());
  try{video.mediaStreamTrack.contentHint=settings.capture.contentHint||"detail";}catch{/* Optional hint. */}
  await video.setDegradationPreference(settings.publish.degradationPreference!);
  const sender=video.sender;if(!sender)throw Error("Браузер не предоставляет настройки кодирования. Профиль применится при следующем показе.");
  const parameters=sender.getParameters();if(!parameters.encodings?.length)throw Error("Настройки кодирования пока недоступны. Профиль применится при следующем показе.");
  for(const encoding of parameters.encodings){const scale=encoding.scaleResolutionDownBy||1;encoding.maxBitrate=Math.round(settings.publish.screenShareEncoding!.maxBitrate/(scale*scale));encoding.maxFramerate=settings.fps;}
  await sender.setParameters(parameters);
  if(!webkitScreenCapture(navigator.userAgent))try{await video.mediaStreamTrack.applyConstraints({width:{ideal:settings.width},height:{ideal:settings.height},frameRate:{ideal:settings.fps,max:settings.fps}});}catch{throw Error("Профиль кодирования применён; браузер сохранил прежний размер захвата.");}
}
export type QualityRow={id:string;direction:"outbound"|"inbound";width:number|null;height:number|null;fps:number|null;kbps:number|null;packetsLost:number|null;packetLoss:number|null;rttMs:number|null;availableKbps:number|null;framesDecoded:number|null;framesDropped:number|null;codec:string|null;ice:string|null;limitation:string|null};
type Stats=Record<string,unknown>;export type PreviousStats=Map<string,{timestamp:number;bytes:number|null;frames:number|null;packets:number|null;lost:number|null}>;
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
export function summarizeVideoStats(entries:Stats[],previous:PreviousStats,key:string):QualityRow[]{
  const byId=new Map(entries.map(entry=>[entry.id,entry]));const transport=entries.find(entry=>entry.type==="transport"&&entry.selectedCandidatePairId);const candidate=(transport?byId.get(transport.selectedCandidatePairId):null)||entries.find(entry=>entry.type==="candidate-pair" && entry.state==="succeeded" && (entry.selected===true || entry.nominated===true));
  const local=candidate?byId.get(candidate.localCandidateId):null,remote=candidate?byId.get(candidate.remoteCandidateId):null;
  return entries.filter(entry=>["outbound-rtp","inbound-rtp"].includes(String(entry.type)) && (entry.kind==="video" || entry.mediaType==="video")).map(entry=>{
    const direction=entry.type==="outbound-rtp"?"outbound":"inbound";const id=key+":"+entry.id;const old=previous.get(id);const timestamp=number(entry.timestamp);const bytes=number(direction==="outbound"?entry.bytesSent:entry.bytesReceived);const frames=number(direction==="outbound"?entry.framesEncoded:entry.framesDecoded);const packets=number(direction==="outbound"?entry.packetsSent:entry.packetsReceived);const remoteReport=direction==="outbound"?byId.get(entry.remoteId)||entries.find(item=>item.type==="remote-inbound-rtp"&&item.localId===entry.id):entry;const lost=number(remoteReport?.packetsLost);const elapsed=timestamp!==null&&old?timestamp-old.timestamp:0;
    const rate=(value:number|null,prior:number|null|undefined,factor:number)=>elapsed>0&&value!==null&&prior!==null&&prior!==undefined&&value>=prior?(value-prior)*factor/elapsed:null;
    const lostDelta=lost!==null&&old?.lost!==null&&old?.lost!==undefined?lost-old.lost:null,packetDelta=packets!==null&&old?.packets!==null&&old?.packets!==undefined?packets-old.packets:null;
    if(timestamp!==null)previous.set(id,{timestamp,bytes,frames,packets,lost});const codec=byId.get(entry.codecId);const rtt=number(remoteReport?.roundTripTime)??number(candidate?.currentRoundTripTime);
    return {id,direction,width:number(entry.frameWidth),height:number(entry.frameHeight),fps:number(entry.framesPerSecond)??rate(frames,old?.frames,1000),kbps:rate(bytes,old?.bytes,8),packetsLost:lost,packetLoss:lostDelta!==null&&lostDelta>=0&&packetDelta!==null&&packetDelta>0&&(direction!=="outbound"||lostDelta<=packetDelta)?100*lostDelta/(direction==="outbound"?packetDelta:packetDelta+lostDelta):null,rttMs:rtt===null?null:rtt*1000,availableKbps:number(candidate?.availableOutgoingBitrate)===null?null:Number(candidate!.availableOutgoingBitrate)/1000,framesDecoded:number(entry.framesDecoded),framesDropped:number(entry.framesDropped),codec:typeof codec?.mimeType==="string"?codec.mimeType:null,ice:typeof local?.candidateType==="string"&&typeof remote?.candidateType==="string"?`${local.candidateType} → ${remote.candidateType}${typeof local.protocol==="string"?` · ${local.protocol}`:""}`:null,limitation:typeof entry.qualityLimitationReason==="string"?entry.qualityLimitationReason:null};
  });
}
