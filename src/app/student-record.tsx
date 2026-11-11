"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Work = { id: string; assignment?: string; score?: string; comment?: string; status?: string; fileUrl?: string; createdAt?: Date };
type Result = { id: string; title?: string; score?: number; total?: number };

export default function StudentRecord({ studentId, teacher = false }: { studentId: string; teacher?: boolean }) {
  const [record, setRecord] = useState<{ email: string; registered: string; status: string; assignments: string[]; work: Work[]; results: Result[] }>();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      const profile = (await getDoc(doc(db, "users", studentId))).data();
      if (!profile?.email) throw new Error();
      const byEmail = (path: string) => getDocs(query(collection(db, path), where("user", "==", profile.email)));
      const assignments = collection(db, "assignments");
      const [work, quiz, exams, shared, personal] = await Promise.all([
        byEmail("submissions"), byEmail("quizResults"), byEmail("examAttempts"),
        getDocs(query(assignments, where("audience", "==", "class"))),
        getDocs(query(assignments, where("audience", "==", "student"), where("assignedToId", "==", studentId))),
      ]);
      if (!alive) return;
      setName(profile.displayName || "");
      setRecord({
        email: profile.email,
        registered: profile.createdAt?.toDate?.().toLocaleDateString("ru-RU") || "—",
        status: profile.status,
        assignments: [...shared.docs, ...personal.docs].map(item => String(item.data().title)),
        work: work.docs.map(item => ({ ...item.data(), id: item.id, createdAt: item.data().createdAt?.toDate?.() } as Work)).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        results: [...quiz.docs, ...exams.docs].map(item => ({ ...item.data(), id: item.id } as Result)),
      });
    }
    load().catch(() => { if (alive) setNotice("Не удалось загрузить профиль и результаты."); });
    return () => { alive = false; };
  }, [studentId]);

  const reviewed = new Set(record?.work.filter(item => item.status === "Проверено").map(item => item.assignment));
  return <section className="students-card student-management">
    <h3>{teacher ? "Профиль ученика" : "Мой профиль и результаты"}</h3>
    {notice && <p role="status">{notice}</p>}
    {!record && !notice && <p>Загрузка…</p>}
    {record && <>
      <p>{record.email} · Регистрация: {record.registered} · {record.status === "active" ? "Активен" : "Доступ приостановлен"}</p>
      <form className="invite-form" onSubmit={async event => {
        event.preventDefault();
        if (!name.trim()) return;
        try {
          await updateDoc(doc(db, "users", studentId), { displayName: name.trim(), updatedAt: serverTimestamp() });
          setNotice("Имя сохранено.");
        } catch { setNotice("Не удалось сохранить имя."); }
      }}>
        <input required maxLength={120} aria-label="Имя и фамилия" value={name} onChange={event => setName(event.target.value)} />
        <button className="secondary" type="submit">Сохранить имя</button>
      </form>
      <p>Прогресс: проверено {record.assignments.filter(title => reviewed.has(title)).length} из {record.assignments.length} заданий.</p>
      <h4>Назначенные задания</h4>
      <p>{record.assignments.length ? record.assignments.join(" · ") : "Заданий пока нет."}</p>
      <h4>История работ</h4>
      {!record.work.length && <p>Отправленных работ пока нет.</p>}
      {record.work.map(work => <article className="assignment" key={work.id}>
        <div><b>{work.assignment}</b><p>{work.status} {work.createdAt?.toLocaleDateString("ru-RU")}</p>
          {work.score && <p>Оценка: {work.score}</p>}{work.comment && <p>{work.comment}</p>}
          {work.fileUrl?.startsWith("https://") && <a href={work.fileUrl} target="_blank" rel="noreferrer">Открыть решение</a>}
          {teacher && <form className="invite-form" onSubmit={async event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const score = String(data.get("score") || "");
            const comment = String(data.get("comment") || "");
            const status = data.get("status") === "returned" ? "Возвращено на доработку" : "Проверено";
            try {
              await updateDoc(doc(db, "submissions", work.id), { score, comment, status, reviewedAt: serverTimestamp(), reviewedBy: auth.currentUser?.uid });
              setRecord(current => current && ({ ...current, work: current.work.map(item => item.id === work.id ? { ...item, score, comment, status } : item) }));
              setNotice("Проверка сохранена.");
            } catch { setNotice("Не удалось сохранить проверку."); }
          }}>
            <input name="score" aria-label="Оценка" type="number" min={0} step="any" defaultValue={work.score} placeholder="Оценка" required />
            <input name="comment" aria-label="Комментарий" maxLength={2000} defaultValue={work.comment} placeholder="Комментарий" />
            <select name="status" aria-label="Результат проверки"><option value="reviewed">Проверено</option><option value="returned">На доработку</option></select>
            <button type="submit" className="secondary">Сохранить проверку</button>
          </form>}
        </div>
      </article>)}
      <h4>Результаты тестов</h4>
      {record.results.length ? record.results.map(item => <p key={item.id}>{item.title || "Экзаменационный вариант"}: {item.score ?? 0} из {item.total ?? 0}</p>) : <p>Результатов пока нет.</p>}
    </>}
  </section>;
}
