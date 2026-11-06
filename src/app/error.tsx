"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><div className="error-card"><div className="eyebrow">Physics Tutor</div><h1>Не удалось открыть раздел</h1><p>Произошла временная ошибка интерфейса. Попробуй обновить раздел.</p><button className="primary" onClick={() => reset()}>Повторить</button></div></main>;
}
