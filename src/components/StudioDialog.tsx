"use client";
import { useEffect, useRef, type ReactNode } from "react";
import s from "./PhysicsStudio.module.css";
export function StudioDialog({ title, id, children, onClose }: { title: string; id: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = ref.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
    (focusable || ref.current)?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className={s.modalBackdrop}><section ref={ref} className={s.modal} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key !== "Tab") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])];
    if (!items.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === ref.current)) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }}><h2 id={id}>{title}</h2>{children}</section></div>;
}
