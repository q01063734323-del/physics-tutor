"use client";

import { PhysicsMark } from "@/components/PhysicsMark";

export default function OfflinePage() {
  return <main className="pt-offline"><section>
    <PhysicsMark />
    <h1>Нет соединения</h1>
    <p>Проверьте интернет и обновите страницу. После восстановления сети задания и прогресс снова будут доступны.</p>
    <button className="primary" type="button" onClick={() => window.location.reload()}>Повторить</button>
  </section></main>;
}
