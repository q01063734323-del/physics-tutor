'use client';

import { useEffect, useRef, type RefObject } from 'react';
import b from './RoyaleBattle.module.css';

export function BattleEnergyBurst({ from, to, mobile }: {
  from: RefObject<HTMLDivElement | null>;
  to: RefObject<HTMLDivElement | null>;
  mobile: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = from.current?.getBoundingClientRect();
    const end = to.current?.getBoundingClientRect();
    if (!start || !end || !layer.current) return;
    const bounds = layer.current.getBoundingClientRect();
    const startX = start.left + (mobile ? start.width * .5 : 25) - bounds.left;
    const startY = start.top + start.height / 2 - bounds.top;
    const endX = end.left + end.width * .32 - bounds.left;
    const endY = end.top + end.height / 2 - bounds.top;
    const animations = Array.from(layer.current.children).map((particle, index) => {
      const bend = (index - 3) * 17;
      return particle.animate([
        { transform: `translate(${startX}px, ${startY}px) scale(.2)`, opacity: 0 },
        { transform: `translate(${startX + (endX - startX) * .45 + bend}px, ${startY + (endY - startY) * .37 - 44 + bend}px) scale(1)`, opacity: 1 },
        { transform: `translate(${endX}px, ${endY}px) scale(.2)`, opacity: 0 },
      ], { duration: 620, delay: index * 35, easing: 'cubic-bezier(.25,.45,.3,1)' });
    });
    return () => { for (const animation of animations) animation.cancel(); };
  }, [from, to, mobile]);

  return <div ref={layer} className={b.particles} aria-hidden="true">
    {Array.from({ length: 7 }, (_, index) => <i key={index}/>)}
  </div>;
}
