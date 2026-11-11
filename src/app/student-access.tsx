"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Student = { id: string; name: string; email: string; status: "active" | "inactive" };

export default function StudentAccess() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const teacher = auth.currentUser;
    if (!teacher) return;
    let cancelled = false;
    async function load(teacherId: string) {
      const links = await getDocs(query(collection(db, "teacherStudents"), where("teacherId", "==", teacherId)));
      const ids = new Set(links.docs.map(link => link.data().studentId).filter((id): id is string => typeof id === "string" && !!id && !id.includes("/")));
      const profiles = await Promise.all([...ids].map(id => getDoc(doc(db, "users", id))));
      if (cancelled) return;
      setStudents(profiles.flatMap(profile => {
        const data = profile.data();
        if (!data || data.role !== "student") return [];
        return [{ id: profile.id, name: data.displayName || data.email, email: data.email, status: data.status === "inactive" ? "inactive" : "active" }];
      }));
    }
    load(teacher.uid).catch(() => {
      if (!cancelled) setNotice("Не удалось загрузить список учеников.");
    });
    return () => { cancelled = true; };
  }, []);

  async function toggle(student: Student) {
    const status = student.status === "active" ? "inactive" : "active";
    setBusy(student.id);
    setNotice("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Войдите в кабинет преподавателя.");
      const response = await fetch("/api/students/status", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, status }),
      });
      if (!response.ok) throw new Error("Не удалось изменить доступ. Обновите страницу, чтобы проверить статус.");
      setStudents(current => current?.map(item => item.id === student.id ? { ...item, status } : item) ?? null);
      setNotice(status === "active" ? "Доступ восстановлен." : "Доступ приостановлен.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось изменить доступ.");
    } finally {
      setBusy(null);
    }
  }

  const filter = search.trim().toLowerCase();
  const visible = students?.filter(student => `${student.name} ${student.email}`.toLowerCase().includes(filter))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return <section className="students-card">
    <div className="section-head"><h3>Доступ учеников</h3></div>
    <div className="invite-form">
      <input aria-label="Поиск ученика" placeholder="Имя или email" value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    {notice && <p role="status">{notice}</p>}
    {students === null && !notice && <p className="muted">Загружаем учеников…</p>}
    {visible?.length === 0 && <p className="muted">{students?.length ? "Никого не нашли." : "Зарегистрированных учеников пока нет."}</p>}
    <div className="invitation-list">{visible?.map(student => <div className="invitation-row" key={student.id}>
      <div><b>{student.name}</b><small>{student.email}</small></div>
      <span className={`tag ${student.status === "active" ? "ready" : ""}`}>{student.status === "active" ? "Активен" : "Доступ приостановлен"}</span>
      <button type="button" className="secondary" disabled={busy !== null} onClick={() => void toggle(student)}>
        {busy === student.id ? "Сохраняем…" : student.status === "active" ? "Приостановить доступ" : "Восстановить доступ"}
      </button>
    </div>)}</div>
  </section>;
}
