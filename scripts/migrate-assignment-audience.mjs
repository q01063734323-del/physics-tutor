import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required");
const app = initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore(app);
const owner = await getAuth(app).getUserByEmail("e.galkin58@mail.ru");
const apply = process.argv.includes("--apply");
const links = await db.collection("teacherStudents").where("teacherId", "==", owner.uid).get();
const recipients = new Map();
for (const link of links.docs) {
  const { studentId, studentEmail } = link.data();
  if (typeof studentId !== "string" || !studentId || studentId.includes("/") || typeof studentEmail !== "string") continue;
  const key = studentEmail.trim().toLowerCase();
  recipients.set(key, new Set([...(recipients.get(key) ?? []), studentId]));
}

for (const snapshot of (await db.collection("assignments").get()).docs) {
  const data = snapshot.data();
  if (data.audience) continue;
  const to = typeof data.assignedTo === "string" ? data.assignedTo.trim() : "";
  const ids = recipients.get(to.toLowerCase());
  const scope = to === "Все ученики" ? { audience: "class", assignedToId: null }
    : ids?.size === 1 ? { audience: "student", assignedToId: [...ids][0] } : null;
  if (!scope || (data.teacherId ?? data.createdById) !== owner.uid) {
    console.log(snapshot.id, "requires manual review");
    continue;
  }
  console.log(snapshot.id, scope.audience, apply ? "applying" : "dry run");
  if (apply) await snapshot.ref.update(scope, { lastUpdateTime: snapshot.updateTime });
}
