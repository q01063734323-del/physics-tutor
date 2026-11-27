import type {Battle} from './engine';
import type {CardId} from './config';
import type {GraphicsQuality} from './quality';
export type GraphicsMode='2d'|'3d';
export type GroundPoint={x:number;y:number};
export type ViewFrame={battle:Battle;selected:CardId|null;alpha:number;previous:Map<number,GroundPoint>;cursor?:GroundPoint;reducedMotion:boolean;quality:GraphicsQuality;ultraEffects?:boolean;lowQuality:boolean};
/** Views consume state; they never advance the simulation or issue game commands. */
export interface BattleView{
 resize(width:number,height:number,dpr:number):void;
 render(frame:ViewFrame):void;
 pick(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}):GroundPoint|null;
 dispose():void;
 diagnostics?():{calls:number;triangles:number;geometries:number;textures:number};
}
