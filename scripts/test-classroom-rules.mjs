import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const dbHost = process.env.FIRESTORE_EMULATOR_HOST;
if (![authHost, dbHost].every(host => /^127\.0\.0\.1:\d+$/.test(host || ""))) {
  throw new Error("Run with both Firebase emulators bound to 127.0.0.1.");
}
const projectId = "demo-physics-tutor";
const db = getFirestore(initializeApp({ projectId }));
const suffix = crypto.randomUUID();
async function student(name) {
  const email = `${name}-${suffix}@example.com`;
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "local-emulator-test", returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  const { localId: uid, idToken } = await response.json();
  return { uid, idToken, email };
}
const [alice, bob, outsider] = await Promise.all([student("alice"), student("bob"), student("outside")]);
for (const account of [alice, bob]) await db.doc(`users/${account.uid}`).set({ role: "student", status: "active", email: account.email, displayName: "Ученик" });
const own = `assignments/own-${suffix}`;
const shared = `assignments/shared-${suffix}`;
const legacy = `assignments/legacy-${suffix}`;
await db.doc(own).set({ audience: "student", assignedToId: alice.uid, teacherId: "teacher" });
await db.doc(shared).set({ audience: "class", assignedToId: null, teacherId: "teacher" });
await db.doc(legacy).set({ assignedTo: alice.email });
const base = `http://${dbHost}/v1/projects/${projectId}/databases/(default)/documents`;
const access = (account, path, init) => fetch(`${base}/${path}`, { ...init, headers: { Authorization: `Bearer ${account.idToken}`, "Content-Type": "application/json" } });
for (const [account, path, status] of [[alice, own, 200], [bob, own, 403], [bob, shared, 200], [outsider, shared, 403], [alice, legacy, 403], [bob, `users/${alice.uid}`, 403]]) {
  assert.equal((await access(account, path)).status, status, path);
}
assert.equal((await access(alice, `users/${alice.uid}?updateMask.fieldPaths=role`, {
  method: "PATCH", body: JSON.stringify({ fields: { role: { stringValue: "teacher" } } }),
})).status, 403);
await db.doc(`users/${alice.uid}`).update({ status: "inactive" });
assert.equal((await access(alice, own)).status, 403);
assert.equal((await access(alice, shared)).status, 403);
console.log("Firebase emulator access tests passed");
