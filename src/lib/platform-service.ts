import { collection, getDocs, query, where, type Firestore } from "firebase/firestore";
import { homeworkRequest } from "./push/client";
import type { Assignment, Submission, UserRole } from "./models";

export async function createPlatformAssignment(db: Firestore, assignment: Assignment) {
  void db;
  return (await homeworkRequest<{id:string}>("create", { assignment }, { title:assignment.title, description:assignment.description, topic:assignment.topic, dueDate:assignment.dueDate, audience:assignment.audience, assignedToId:assignment.assignedToId })).id;
}

export async function listPlatformAssignments(db: Firestore, userId: string, role: UserRole) {
  const source = role === "teacher"
    ? query(collection(db, "assignments"), where("teacherId", "==", userId))
    : query(collection(db, "assignments"), where("assignedToId", "==", userId));
  const snapshot = await getDocs(source);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Assignment);
}

export async function createPlatformSubmission(db: Firestore, submission: Submission) {
  void db;
  return (await homeworkRequest<{id:string}>("submit", { submission }, { assignmentId:submission.assignmentId, fileName:(submission as Submission & {fileName?:string}).fileName, fileSize:(submission as Submission & {fileSize?:number}).fileSize })).id;
}

export async function listStudentSubmissions(db: Firestore, studentId: string) {
  const snapshot = await getDocs(query(collection(db, "submissions"), where("userId", "==", studentId)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Submission);
}

export async function listTeacherSubmissions(db: Firestore, teacherId: string) {
  const snapshot = await getDocs(query(collection(db, "submissions"), where("teacherId", "==", teacherId)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Submission);
}
