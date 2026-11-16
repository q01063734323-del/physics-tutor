"use client";

import { useEffect, useRef, type ReactNode, type PointerEvent } from "react";

/** CSS owns motion; observers suspend it outside the viewport and hidden tabs. */
export function MotionScene({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let visible = false;
    const sync = () => { root.dataset.running = String(visible && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { rootMargin: "40px" });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return <div ref={ref} className={className} data-motion-scene data-running="false">{children}</div>;
}

export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--tilt-x", `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 7}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(event.clientX - rect.left - rect.width / 2) / rect.width * 7}deg`);
  }
  return <div className={className} data-tilt onPointerMove={move} onPointerLeave={event => { event.currentTarget.style.setProperty("--tilt-x", "0deg"); event.currentTarget.style.setProperty("--tilt-y", "0deg"); }}>{children}</div>;
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only hide after enhancement, so content remains visible without JavaScript.
    if (root.getBoundingClientRect().top > window.innerHeight) root.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { root.dataset.reveal = "shown"; observer.disconnect(); }
    }, { threshold: .08 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={className} data-reveal="shown">{children}</div>;
}

export function MagneticLink({ children, href, className = "" }: { children: ReactNode; href: string; className?: string }) {
  return <a href={href} className={className} onPointerMove={event => {
    if (!window.matchMedia("(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.translate = `${(event.clientX - rect.left - rect.width / 2) * .07}px ${(event.clientY - rect.top - rect.height / 2) * .09}px`;
  }} onPointerLeave={event => { event.currentTarget.style.translate = "0px 0px"; }}>{children}</a>;
}

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 950, 1);
        element.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: .7 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={ref} aria-label={String(value)}>{value}</span>;
}
