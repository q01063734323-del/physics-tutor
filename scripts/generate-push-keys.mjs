// Run intentionally in your own terminal. Never commit or share the generated secrets.
import * as webpush from 'web-push';
import { randomBytes } from 'node:crypto';
const keys = webpush.generateVAPIDKeys();
console.log(`WEB_PUSH_PUBLIC_KEY=${keys.publicKey}\nWEB_PUSH_PRIVATE_KEY=${keys.privateKey}\nPUSH_CRON_SECRET=${randomBytes(32).toString('hex')}`);
