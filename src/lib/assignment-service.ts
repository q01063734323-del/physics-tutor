import { addDoc, collection, getDocs, serverTimestamp, type Firestore } from "firebase/firestore";
import type { Assignment, Submission } from "./models";

export async function createAssignment(db: Firestore, assignment: Assignment) {
  const ref = await addDoc(collection(db, "assignments"), { ...assignment, createdAt: serverTimestamp() });
  return ref.id;
}

export async function listAssignments(db: Firestore) {
  const snapshot = await getDocs(collection(db, "assignments"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Assignment));
}

export async function createSubmission(db: Firestore, submission: Submission) {
  const ref = await addDoc(collection(db, "submissions"), { ...submission, createdAt: serverTimestamp() });
  return ref.id;
}
