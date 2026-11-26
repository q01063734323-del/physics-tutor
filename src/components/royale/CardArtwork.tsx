/* eslint-disable @next/next/no-img-element -- Static, sized local card renders. */
import type {CardId} from '@/lib/royale/config';

export function CardArtwork({id,className,collection=false}:{id:CardId;className?:string;collection?:boolean}) {
 const url=id==='knight'
  ? `/royale/dawn-knight/${collection?'card-collection':'portrait-game'}.webp`
  : `/royale/v1/${id}.webp`;
 return <img className={className} src={url} alt="" loading="lazy" decoding="async"/>;
}
