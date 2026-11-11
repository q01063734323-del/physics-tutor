"use client";

import { use, useState } from "react";
import Link from "next/link";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) { setMessage("Пароль должен содержать минимум 6 символов."); return; }
    if (password !== confirm) { setMessage("Пароли не совпадают."); return; }
    setMessage("Создаём аккаунт…");
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.error || "Приглашение недействительно."); return; }
    setDone(true); setMessage("Аккаунт создан. Теперь войди на главной странице по email и новому паролю.");
  }
  return <main className="invite-page"><section className="invite-card"><div className="brand"><span className="brand-mark">φ</span><span>Физика с Егором</span></div><div className="eyebrow">Приглашение ученика</div><h1>{done ? "Регистрация завершена" : "Создай пароль"}</h1>{!done && <form onSubmit={submit}><p>Придумай пароль для личного кабинета ученика.</p><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Новый пароль" autoComplete="new-password" required /><input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Повтори пароль" autoComplete="new-password" required /><button className="primary" type="submit">Создать аккаунт</button></form>}{message && <div className={`invite-message ${done ? "success" : ""}`}>{message}</div>}{done && <Link className="primary invite-link" href="/">Перейти ко входу</Link>}</section></main>;
}
