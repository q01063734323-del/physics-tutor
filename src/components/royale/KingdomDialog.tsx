'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import k from './Kingdom.module.css';

export function KingdomDialog({ title, children, onClose, kind, className }: {
 title: string; children: ReactNode; onClose: () => void; kind?: string; className?: string;
}) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current!;
  dialog.showModal();
  return () => { dialog.close(); };
 }, []);
 return <dialog ref={ref} className={className ?? k.dialog} data-kind={kind} aria-label={title} onCancel={event => {
  event.preventDefault();
  onClose();
 }}>{children}</dialog>;
}
