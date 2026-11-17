/* eslint-disable @next/next/no-img-element -- Keep private source scans out of public image optimization. */
"use client";

import { useState } from "react";
import styles from "./QuestionTrainer.module.css";

export default function SourceScan({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [broken, setBroken] = useState(false);
  return <>
    <div className={styles.scanZoom}>
      <button type="button" aria-label={`Уменьшить скан: ${alt}`} disabled={scale <= 1} onClick={() => setScale(value => Math.max(1, value - 0.5))}>−</button>
      <span>{Math.round(scale * 100)}%</span>
      <button type="button" aria-label={`Увеличить скан: ${alt}`} disabled={scale >= 4} onClick={() => setScale(value => Math.min(4, value + 0.5))}>+</button>
      <a href={src} target="_blank" rel="noreferrer">Открыть крупно ↗</a>
    </div>
    {broken ? <div role="alert" className={styles.feedback}>Скан не загрузился. Обнови предпросмотр или открой исходную страницу.</div> : <div className={`${styles.scanViewport} ${scale > 1 ? styles.scanViewportZoomed : ""}`}><img src={src} alt={alt} style={{ width: `${scale * 100}%`, maxWidth: "none" }} loading="lazy" onError={() => setBroken(true)} /></div>}
  </>;
}
