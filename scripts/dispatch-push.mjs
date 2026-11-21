// External schedule runner. It wakes a sleeping Render service via HTTPS.
// No Firebase credentials or VAPID private key are needed in this process.
const origin = process.env.PUSH_DISPATCH_ORIGIN;
const secret = process.env.PUSH_CRON_SECRET;
if (!origin || !secret || secret.length < 32) throw Error('Configure PUSH_DISPATCH_ORIGIN and PUSH_CRON_SECRET');
const url = new URL('/api/push/dispatch', origin);
if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use the HTTPS site origin');
let passed = false;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(150_000), redirect: 'error' });
    if (response.status === 401 || response.status === 403) throw Error('Scheduler authorization failed');
    if (!response.ok) throw Error(`Dispatcher HTTP ${response.status}`);
    const result = await response.json();
    if (result.enabled === false) throw Error('Web Push is not enabled on the server');
    console.log(JSON.stringify({ accepted: result.accepted || 0, uncertain: result.uncertain || 0, busy: Boolean(result.busy) }));
    passed = true; break;
  } catch (error) {
    // Do not log request headers, endpoint addresses or server secrets.
    console.error(`Push schedule attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'network error'}`);
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
if (!passed) process.exitCode = 1;
