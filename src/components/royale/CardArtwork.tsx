/* eslint-disable @next/next/no-img-element -- Static, sized local card renders. */
import type {CardId} from '@/lib/royale/config';

export function CardArtwork({id,className}:{id:CardId;className?:string}) {
 return <img className={className} src={`/royale/v1/${id}.webp`} alt="" loading="lazy" decoding="async"/>;
}
