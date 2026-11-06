import { addDoc, collection, getDocs, query, serverTimestamp, where, type Firestore } from "firebase/firestore";
import type { Assignment, AssignmentStatus, Submission, UserRole } from "./models";

export async function createPlatformAssignment(db: Firestore, assignment: Assignment) {
  const ref = await addDoc(collection(db, "assignments"), { ...assignment, createdAt: serverTimestamp() });
  return ref.id;
}

export async function listPlatformAssignments(db: Firestore, userId: string, role: UserRole) {
  const source = role === "teacher"
    ? query(collection(db, "assignments"), where("teacherId", "==", userId))
    : query(collection(db, "assignments"), where("assignedToId", "==", userId));
  const snapshot = await getDocs(source);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Assignment);
}

export async function createPlatformSubmission(db: Firestore, submission: Submission) {
  const ref = await addDoc(collection(db, "submissions"), { ...submission, status: submission.status || ("submitted" as AssignmentStatus), createdAt: serverTimestamp() });
  return ref.id;
}

export async function listStudentSubmissions(db: Firestore, studentId: string) {
  const snapshot = await getDocs(query(collection(db, "submissions"), where("userId", "==", studentId)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Submission);
}

export async function listTeacherSubmissions(db: Firestore, teacherId: string) {
  const snapshot = await getDocs(query(collection(db, "submissions"), where("teacherId", "==", teacherId)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Submission);
}
