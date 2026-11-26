import type { CardId } from '../config';
import type { ArenaQuality } from './arena-model';

const premium = new Set(['giant','frost']);
const remastered = new Set(['rider','ember','ballista','meteor','hunters','hunters-silver']);

export function figureAsset(id: CardId | 'hunters-silver', quality: ArenaQuality = 'medium') {
 if (id === 'knight') return '/royale/dawn-knight/knight-' + quality + '.glb';
 const folder = premium.has(id) ? 'v3' : remastered.has(id) ? 'remaster' : 'v1';
 return '/royale/' + folder + '/' + (id === 'spears' ? 'wind' : id) + '.glb';
}
