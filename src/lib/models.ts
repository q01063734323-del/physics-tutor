export type UserRole = "student" | "teacher";
export type StudentStatus = "invited" | "active" | "inactive";
export type UserProfile = { uid: string; email: string; role: UserRole; displayName?: string; createdAt?: unknown; updatedAt?: unknown };
export type TeacherStudentLink = { id?: string; teacherId: string; studentId: string; status: "active" | "invited" | "archived"; createdAt?: unknown };
export type StudentProfile = UserProfile & { role: "student"; displayName?: string; status: StudentStatus; registeredAt?: unknown; lastActiveAt?: unknown };
export type StudentInvitation = { id?: string; teacherId: string; email: string; displayName: string; tokenHash: string; status: "pending" | "accepted" | "expired" | "revoked"; expiresAt: unknown; createdAt?: unknown; acceptedAt?: unknown };
export type AssignmentStatus = "new" | "in_progress" | "submitted" | "reviewed" | "returned" | "На проверке" | "Проверено" | "Возвращено на доработку" | "Отправлено";
export type QuestionType = "single_choice" | "multi_choice" | "numeric" | "sequence" | "matching" | "ordering" | "written";

export type Assignment = {
  id?: string;
  createdById?: string;
  teacherId?: string;
  title: string;
  description: string;
  topic: string;
  level: string;
  due: string;
  assignedTo: string;
  status?: AssignmentStatus;
  materialUrl?: string;
  createdBy?: string;
  createdAt?: unknown;
};

export type Question = {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer?: string | number | string[];
  tolerance?: number;
  explanation?: string;
  points: number;
};

export type Submission = {
  id?: string;
  userId?: string;
  teacherId?: string;
  assignmentId?: string;
  assignment: string;
  user: string;
  status: AssignmentStatus;
  fileUrl?: string;
  answer?: unknown;
  score?: number | string;
  maxScore?: number;
  comment?: string;
  createdAt?: unknown;
  reviewedAt?: unknown;
};
