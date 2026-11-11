"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { PhysicsMark } from "@/components/PhysicsMark";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 6) { setMessage("Пароль должен содержать минимум 6 символов."); return; }
    if (password !== confirm) { setMessage("Пароли не совпадают."); return; }
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(response.status >= 500 ? "Не удалось создать аккаунт. Попробуйте позже." : payload.error || "Приглашение недействительно.");
        return;
      }
      setDone(true);
      setMessage("Аккаунт создан. Войдите по email и новому паролю.");
    } catch {
      setMessage("Не удалось подключиться. Проверьте интернет и повторите попытку.");
    } finally { setBusy(false); }
  }

  return <main className="invite-page"><section className="invite-card pt-invite">
    <PhysicsMark />
    <p className="pt-kicker">ПРИГЛАШЕНИЕ УЧЕНИКА</p>
    <h1>{done ? "Регистрация завершена" : "Создайте пароль"}</h1>
    {!done && <form onSubmit={submit} aria-busy={busy}>
      <p>Этот пароль понадобится для входа в ваш кабинет.</p>
      <label>Новый пароль<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required /></label>
      <label>Повторите пароль<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Создаём аккаунт…" : "Создать аккаунт"}</button>
    </form>}
    {message && <div className={`invite-message ${done ? "success" : ""}`} role="status">{message}</div>}
    {done && <Link className="primary invite-link" href="/#login">Перейти ко входу</Link>}
  </section></main>;
}
