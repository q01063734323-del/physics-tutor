import { createPlatformAssignment, createPlatformSubmission } from "./platform-service";
import { collection, getDocs, type Firestore } from "firebase/firestore";
import type { Assignment, Submission } from "./models";

export async function createAssignment(db: Firestore, assignment: Assignment) {
  return createPlatformAssignment(db, assignment);
}

export async function listAssignments(db: Firestore) {
  const snapshot = await getDocs(collection(db, "assignments"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Assignment));
}

export async function createSubmission(db: Firestore, submission: Submission) {
  return createPlatformSubmission(db, submission);
}
