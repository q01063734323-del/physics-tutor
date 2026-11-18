"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { loadStudyState, saveStudyState } from "./storage";
import { mergeCloudResults, type StudyState } from "./engine";
import { canSyncLearning, firebaseLearningTransport, flushLearningResults } from "./sync";

export function useStudy(account: string, demo: boolean) {
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const current = useRef<StudyState | null>(null);
  const queue = useRef(Promise.resolve());
  const alive = useRef(false);
  const syncingNow = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    alive.current = true;
    let mounted = true;
    loadStudyState(account).then(value => { if (mounted) { current.current = value; setState(value); setError(""); } })
      .catch(() => { if (mounted) setError("Не удалось открыть сохранения на устройстве. Разреши хранение данных сайта или повтори попытку."); });
    return () => { mounted = false; alive.current = false; };
  }, [account, reload]);

  const update = useCallback((change: (previous: StudyState) => StudyState): Promise<void> => {
    const next = queue.current.catch(() => undefined).then(async () => {
      if (!current.current) throw new Error("Сохранения ещё загружаются.");
      if (alive.current) setSaving(true);
      const value = change(current.current);
      try {
        await saveStudyState(account, value);
        current.current = value;
        if (alive.current) { setState(value); setError(""); }
      } catch (cause) {
        if (alive.current) setError("Сохранение не завершилось. Не закрывай вкладку и повтори действие: предыдущие результаты не удалены.");
        throw cause;
      } finally { if (alive.current) setSaving(false); }
    });
    queue.current = next; return next;
  }, [account]);

  const synchronize = useCallback(async () => {
    const user = auth.currentUser;
    if (!canSyncLearning(account, user, demo) || !user || !current.current || syncingNow.current) return;
    syncingNow.current = true;
    if (alive.current) setSyncing(true);
    try {
      const result = await flushLearningResults(current.current.pending, true, firebaseLearningTransport(user));
      await update(previous => mergeCloudResults(previous, [...result.remote, ...result.acknowledged]));
      if (alive.current) setSyncMessage(result.failed.length ? "Сохранено на устройстве. Синхронизацию можно повторить." : "Прогресс синхронизирован с аккаунтом.");
    } catch { if (alive.current) setSyncMessage("Результаты сохранены на устройстве и ожидают синхронизации."); }
    finally { syncingNow.current = false; if (alive.current) setSyncing(false); }
  }, [account, demo, update]);

  const ready = Boolean(state);
  useEffect(() => {
    if (!ready) return;
    let attached = true;
    const online = () => void synchronize();
    queueMicrotask(() => { if (attached) online(); });
    window.addEventListener("online", online);
    return () => { attached = false; window.removeEventListener("online", online); };
  }, [ready, synchronize]);

  return { state, error, saving, syncing, syncMessage, update, synchronize, retry: () => setReload(value => value + 1),
    cloudAvailable: !demo && !["guest", "demo-student", "demo-teacher"].includes(account) };
}
