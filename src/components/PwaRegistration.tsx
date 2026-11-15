"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegistration() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let lastCheck = Date.now();

    function checkWaiting() {
      if (active && navigator.serviceWorker.controller && registration?.waiting) setWaiting(registration.waiting);
    }
    function checkUpdate() {
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", checkWaiting);
    }
    function activateUpdate() {
      if (reloadRequested.current) window.location.reload();
    }
    function checkOnReturn() {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 60 * 60 * 1000) {
        lastCheck = Date.now();
        void registration?.update().catch(() => undefined);
      }
    }
    function installAvailable(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    function installed() { setInstallPrompt(null); }

    navigator.serviceWorker.addEventListener("controllerchange", activateUpdate);
    window.addEventListener("beforeinstallprompt", installAvailable);
    window.addEventListener("appinstalled", installed);
    document.addEventListener("visibilitychange", checkOnReturn);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(result => {
      if (!active) return;
      registration = result;
      checkWaiting();
      registration.addEventListener("updatefound", checkUpdate);
      checkUpdate();
    }).catch(() => { /* The online app remains available if service workers are unavailable. */ });

    return () => {
      active = false;
      installing?.removeEventListener("statechange", checkWaiting);
      registration?.removeEventListener("updatefound", checkUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", activateUpdate);
      window.removeEventListener("beforeinstallprompt", installAvailable);
      window.removeEventListener("appinstalled", installed);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, []);

  const showInstall = pathname === "/" && installPrompt && !dismissed;
  if (!waiting && !showInstall) return null;
  return <aside className="pt-pwa-notice" aria-label={waiting ? "Обновление приложения" : "Установка приложения"}>
    <p role="status">{waiting ? "Доступна новая версия приложения." : "Физика с Егором на главном экране."}</p>
    <div>
      {waiting ? <button type="button" onClick={() => {
        reloadRequested.current = true;
        waiting.postMessage({ type: "SKIP_WAITING" });
      }}>Обновить</button> : <button type="button" onClick={async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
      }}>Установить</button>}
      <button type="button" className="pt-pwa-later" onClick={() => {
        setWaiting(null);
        setDismissed(true);
      }}>Позже</button>
    </div>
  </aside>;
}
