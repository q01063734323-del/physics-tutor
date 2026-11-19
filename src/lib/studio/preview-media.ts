/** getUserMedia cannot be aborted. Stop a late grant after the UI has timed out. */
export function withMediaTimeout<T extends { getTracks: () => { stop: () => void }[] }>(capture: Promise<T>, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; const error = new Error("Браузер ожидает разрешения на устройство. Проверь запрос доступа и повтори проверку."); error.name = "TimeoutError"; reject(error); }, timeoutMs);
    capture.then(stream => { clearTimeout(timer); if (expired) stream.getTracks().forEach(track => track.stop()); else resolve(stream); }, error => { clearTimeout(timer); if (!expired) reject(error); });
  });
}
