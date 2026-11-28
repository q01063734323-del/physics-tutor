"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { feedbackTopics } from "@/lib/royale/beta-feedback";
import styles from "./FeedbackForm.module.css";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || complete) return;
    const form = new FormData(event.currentTarget);
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/royale/feedback", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: form.get("topic"), rating: Number(form.get("rating")) }),
      });
      if (!response.ok) throw new Error();
      setComplete(true);
      setMessage("Спасибо, отзыв отправлен.");
    } catch {
      setMessage("Отзыв пока не отправлен. Попробуй чуть позже.");
    } finally {
      setSending(false);
    }
  }

  return <main className="invite-page"><section className="invite-card">
    <h1>Отзыв о Physics Royale</h1>
    <p>Форма отправляет тему и оценку без данных аккаунта.</p>
    {!complete && <form className={styles.form} onSubmit={submit} aria-busy={sending}>
      <label>Тема <select name="topic" required>
        <option value="">Выбери тему</option>
        {Object.entries(feedbackTopics).map(([value, title]) => <option value={value} key={value}>{title}</option>)}
      </select></label>
      <label>Оценка <select name="rating" required>
        <option value="">Выбери оценку</option>
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} из 5</option>)}
      </select></label>
      <button type="submit" className="primary" disabled={sending}>{sending ? "Отправляем…" : "Отправить отзыв"}</button>
    </form>}
    <p role="status">{message}</p>
    <Link href="/royale">Вернуться в игру</Link>
  </section></main>;
}
