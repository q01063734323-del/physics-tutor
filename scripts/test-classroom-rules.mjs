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
async function student(name, email = `${name}-${suffix}@example.com`) {
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
const access = (account, path, init) => fetch(`${base}${path.startsWith(":") ? "" : "/"}${path}`, { ...init, headers: { Authorization: `Bearer ${account.idToken}`, "Content-Type": "application/json" } });
for (const [account, path, status] of [[alice, own, 200], [bob, own, 403], [bob, shared, 200], [outsider, shared, 403], [alice, legacy, 403], [bob, `users/${alice.uid}`, 403]]) {
  assert.equal((await access(account, path)).status, status, path);
}
assert.equal((await access(alice, `users/${alice.uid}?updateMask.fieldPaths=role`, {
  method: "PATCH", body: JSON.stringify({ fields: { role: { stringValue: "teacher" } } }),
})).status, 403);
const teacher = await student("teacher", "e.galkin58@mail.ru");
const classroom = `classroomRooms/${suffix}`;
const board = `${classroom}/board/state`;
const expiry = new Date(Date.now() + 60_000);
await db.doc(classroom).set({
  teacherId: teacher.uid, studentId: alice.uid, status: "open", studentRemoved: false, expiresAt: expiry,
});
await db.doc(board).set({ strokes: [], notes: {}, expiresAt: expiry });
for (const [account, path, status] of [
  [teacher, classroom, 200], [teacher, board, 200], [alice, classroom, 200], [alice, board, 200],
  [bob, classroom, 403], [bob, board, 403], [outsider, board, 403],
]) {
  assert.equal((await access(account, path)).status, status, path);
}
assert.equal((await access(alice, board, { method: "DELETE" })).status, 403, "student cannot bypass server writes");
assert.equal((await access(teacher, classroom, { method: "DELETE" })).status, 403, "teacher must use moderation endpoint");
await db.doc(classroom).update({ studentRemoved: true });
assert.equal((await access(alice, classroom)).status, 200, "student can see the removal notice");
assert.equal((await access(alice, board)).status, 403, "removed student cannot read the board");
assert.equal((await access(teacher, board)).status, 200);
await db.doc(classroom).update({ status: "ended" });
assert.equal((await access(teacher, board)).status, 403, "finished board is closed");
const list = async (account, filters) => {
  const where = filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
  const response = await access(account, ":runQuery", {
    method: "POST", body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "assignments" }], where } }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).flatMap(entry => entry.document ? [entry.document.name.split("/").at(-1)] : []);
};
const eq = (fieldPath, value) => ({ fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue: value } } });
assert.deepEqual(await list(alice, [eq("audience", "student"), eq("assignedToId", alice.uid)]), [own.split("/").at(-1)]);
assert.deepEqual(await list(bob, [eq("audience", "student"), eq("assignedToId", bob.uid)]), []);
assert.deepEqual(await list(bob, [eq("audience", "class")]), [shared.split("/").at(-1)]);

const submission = `submissions/answer-${suffix}`;
const body = (account, score) => {
  const values = {
    assignment: "Test", assignmentId: own.split("/").at(-1), teacherId: "teacher", assignmentText: "",
    status: "На проверке", fileUrl: "https://example.com/answer", fileName: "answer.pdf", fileType: "application/pdf",
    fileSize: 100, user: account.email, userId: account.uid, reviewedBy: null, comment: "", score,
  };
  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, value === null ? { nullValue: null } : typeof value === "number" ? { integerValue: String(value) } : { stringValue: value }]));
  return JSON.stringify({ writes: [{
    update: { name: `projects/${projectId}/databases/(default)/documents/${submission}`, fields },
    updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
    currentDocument: { exists: false },
  }] });
};
for (const [account, score, status] of [[bob, "", 403], [alice, "10", 403], [alice, "", 200]]) {
  const result = await access(account, ":commit", { method: "POST", body: body(account, score) });
  assert.equal(result.status, status, await result.text());
}
const grade = { method: "PATCH", body: JSON.stringify({ fields: { score: { stringValue: "8" } } }) };
assert.equal((await access(alice, `${submission}?updateMask.fieldPaths=score`, grade)).status, 403);
assert.equal((await access(teacher, `${submission}?updateMask.fieldPaths=score`, grade)).status, 200);
assert.equal((await (await access(alice, submission)).json()).fields.score.stringValue, "8");
assert.equal((await access(bob, submission)).status, 403);

await db.doc(`users/${alice.uid}`).update({ status: "inactive" });
assert.equal((await access(alice, own)).status, 403);
assert.equal((await access(alice, shared)).status, 403);
console.log("Firebase emulator access tests passed");
