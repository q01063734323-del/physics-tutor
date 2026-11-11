export const ALL_STUDENTS = "Все ученики";

export function assignmentAudience(value: string, students: readonly { id: string; email: string }[]) {
  if (value === ALL_STUDENTS) return { audience: "class", assignedToId: null } as const;
  const student = students.find(item => item.email === value);
  if (!student) throw new Error("Выберите зарегистрированного ученика.");
  return { audience: "student", assignedToId: student.id } as const;
}
