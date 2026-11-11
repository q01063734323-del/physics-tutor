"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import StudentRecord from "./student-record";
import { auth, db } from "@/lib/firebase";

type Student = { registered: number; id: string; name: string; email: string; status: "active" | "inactive" };

type Review = { user?: string; assignment?: string; status?: string; createdAt?: unknown };
function reviewTime(value: unknown) {
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
  return 0;
}

export default function StudentAccess({ reviews, summaryOnly }: { reviews: Review[]; summaryOnly: boolean }) {
  const [weekStart] = useState(() => Date.now() - 604800000);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [open, setOpen] = useState<string>();


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
        return [{ registered: data.createdAt?.toMillis?.() ?? 0, id: profile.id, name: data.displayName || data.email, email: data.email, status: data.status === "inactive" ? "inactive" : "active" }];
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
  const visible = students?.filter(student => (filterStatus === "all" || student.status === filterStatus) && `${student.name} ${student.email}`.toLowerCase().includes(filter))
    .sort((a, b) => sortBy === "newest" ? b.registered - a.registered : a.name.localeCompare(b.name, "ru"));
  const latest = reviews.filter(review => reviewTime(review.createdAt) > 0)
    .sort((a, b) => reviewTime(b.createdAt) - reviewTime(a.createdAt)).slice(0, 5);
  if (summaryOnly) return <section className="students-card student-management">
    <h3>Мой класс</h3>
    {students && <p>Учеников: {students.length} · Активных: {students.filter(item => item.status === "active").length} · Новых за неделю: {students.filter(item => item.registered >= weekStart).length}</p>}
    <p>Работ на проверке: {reviews.filter(review => ["На проверке", "Отправлено"].includes(review.status || "")).length}</p>
    <h4>Последние работы</h4>
    {latest.length ? latest.map((review, index) => <p key={index}>{review.user} · {review.assignment} · {new Date(reviewTime(review.createdAt)).toLocaleDateString("ru-RU")}</p>) : <p>Активности пока нет.</p>}
  </section>;
  return <section className="students-card student-management">
    <div className="section-head"><h3>Доступ учеников</h3></div>
    {students && <p>Всего: {students.length} · Активных: {students.filter(item => item.status === "active").length} · Новых за 7 дней: {students.filter(item => item.registered >= weekStart).length}</p>}
    <div className="invite-form">
      <input aria-label="Поиск ученика" placeholder="Имя или email" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Статус" value={filterStatus} onChange={event => setFilterStatus(event.target.value)}><option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Приостановленные</option></select>
      <select aria-label="Сортировка" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="name">По имени</option><option value="newest">Сначала новые</option></select>
    </div>
    {notice && <p role="status">{notice}</p>}
    {students === null && !notice && <p className="muted">Загружаем учеников…</p>}
    {visible?.length === 0 && <p className="muted">{students?.length ? "Никого не нашли." : "Зарегистрированных учеников пока нет."}</p>}
    <div className="invitation-list">{visible?.map(student => <div className="invitation-row" key={student.id}>
      <div><b>{student.name}</b><small>{student.email} · {student.registered ? new Date(student.registered).toLocaleDateString("ru-RU") : "—"}</small><button type="button" className="secondary" onClick={() => setOpen(open === student.id ? undefined : student.id)}>{open === student.id ? "Закрыть профиль" : "Открыть профиль"}</button></div>
      <div><small>Выполнено: {new Set(reviews.filter(review => review.user === student.email && review.status === "Проверено").map(review => review.assignment)).size}</small><small>Последняя работа: {(() => { const last = Math.max(0, ...reviews.filter(review => review.user === student.email).map(review => reviewTime(review.createdAt))); return last ? new Date(last).toLocaleDateString("ru-RU") : "—"; })()}</small></div>
      <span className={`tag ${student.status === "active" ? "ready" : ""}`}>{student.status === "active" ? "Активен" : "Доступ приостановлен"}</span>
      <button type="button" className="secondary" disabled={busy !== null} onClick={() => void toggle(student)}>
        {busy === student.id ? "Сохраняем…" : student.status === "active" ? "Приостановить доступ" : "Восстановить доступ"}
      </button>
    </div>)}</div>
    {open && <StudentRecord key={open} studentId={open} teacher />}
  </section>;
}
