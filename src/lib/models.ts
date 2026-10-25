export type UserRole = "student" | "teacher";
export type AssignmentStatus = "new" | "in_progress" | "submitted" | "reviewed" | "returned";
export type QuestionType = "single_choice" | "multi_choice" | "numeric" | "sequence" | "matching" | "ordering" | "written";

export type Assignment = {
  id?: string;
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
  assignmentId?: string;
  assignment: string;
  user: string;
  status: AssignmentStatus;
  fileUrl?: string;
  answer?: unknown;
  score?: number;
  maxScore?: number;
  comment?: string;
  createdAt?: unknown;
  reviewedAt?: unknown;
};
