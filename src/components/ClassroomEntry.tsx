"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { classroomRequest } from "@/lib/classroom-client";
import { isClassroomId, type ClassroomRole, type ClassroomSession, type ClassroomStudent } from "@/lib/classroom";
import { ClassroomWorkspace } from "./ClassroomWorkspace";

const ClassroomLesson = dynamic(() => import("./ClassroomLesson").then(module => module.ClassroomLesson), {
  loading: () => <main className="pt-classroom"><p role="status">Открываем онлайн-урок…</p></main>,
  ssr: false,
});

export function ClassroomEntry() {
  const params = useSearchParams();
  const invite = params.get("room");
  const [user, setUser] = useState<User | null>();
  const [account, setAccount] = useState<{ role: ClassroomRole; students: ClassroomStudent[] } | null>(null);
  const [studentId, setStudentId] = useState("");
  const [code, setCode] = useState(invite ?? "");
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => onAuthStateChanged(auth, nextUser => {
    setUser(nextUser);
    setAccount(null);
    setSession(null);
  }), []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    classroomRequest<{ role: ClassroomRole; students: ClassroomStudent[] }>(user, undefined, controller.signal)
      .then(setAccount)
      .catch(problem => { if (!controller.signal.aborted) setError(problem.message); });
    return () => controller.abort();
  }, [user]);

  async function enter(event: FormEvent<HTMLFormElement>, create: boolean) {
    event.preventDefault();
    if (!user || busy) return;
    let roomId = code.trim();
    if (!create && !isClassroomId(roomId)) {
      try { roomId = new URL(roomId).searchParams.get("room") ?? ""; } catch { /* a code can be pasted directly */ }
      if (!isClassroomId(roomId)) { setError("Введите код комнаты или вставьте ссылку на урок."); return; }
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await classroomRequest<ClassroomSession>(user, create ? { action: "create", studentId } : { action: "join", roomId });
      if (auth.currentUser?.uid !== user.uid) return;
      setSession(next);
      setCode(next.roomId);
      window.history.replaceState(null, "", `/classroom?room=${next.roomId}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Не удалось открыть урок.");
    } finally { setBusy(false); }
  }

  const leave = useCallback((message: string, resume?: boolean) => {
    setSession(null);
    setNotice(message);
    if (!resume) {
      setCode("");
      window.history.replaceState(null, "", "/classroom");
    }
  }, []);

  if (session && user) return <ClassroomLesson key={session.roomId} session={session} user={user} onLeave={leave} />;

  return (
    <ClassroomWorkspace lobby={
      <section className="pt-lesson-lobby" aria-labelledby="pt-lesson-title">
        <div><h2 id="pt-lesson-title">Онлайн-урок</h2><p>Видеосвязь, показ экрана и общая доска для двух участников.</p></div>
        {user === undefined && <p role="status">Проверяем вход…</p>}
        {user === null && <Link className="pt-action" href={isClassroomId(invite) ? `/?classroom=${invite}#login` : "/#login"}>Войти в Physics Tutor</Link>}
        {user && account?.role === "teacher" && (
          <form onSubmit={event => void enter(event, true)}>
            <label>Пригласить ученика<select required value={studentId} onChange={event => setStudentId(event.target.value)}>
              <option value="">Выберите ученика</option>
              {account.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select></label>
            <button type="submit" className="pt-action" disabled={busy || !account.students.length}>Создать урок</button>
            {!account.students.length && <p>Активные ученики появятся здесь после регистрации по вашему приглашению.</p>}
          </form>
        )}
        {user && account && (
          <form onSubmit={event => void enter(event, false)}>
            <label>{account.role === "teacher" ? "Вернуться в урок" : "Ссылка или код урока"}
              <input value={code} onChange={event => setCode(event.target.value)} placeholder="Вставьте ссылку или код" required />
            </label>
            <button type="submit" className="pt-action" disabled={busy}>{busy ? "Открываем…" : "Подключиться"}</button>
          </form>
        )}
        {error && <p className="pt-lesson-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
    } />
  );
}
