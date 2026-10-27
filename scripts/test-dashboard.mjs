import assert from "node:assert/strict";
import { isOverdue, submissionStats, learningStreak } from "../src/lib/dashboard.ts";

assert.equal(isOverdue({ title: "A", dueDate: "2026-10-25" }, new Date("2026-10-27T12:00:00")), true);
assert.equal(isOverdue({ title: "A", dueDate: "2026-10-30" }, new Date("2026-10-27T12:00:00")), false);
const assignments = [{ title: "A", dueDate: "2026-10-25" }, { title: "B", dueDate: "2026-10-30" }];
const submissions = [{ assignment: "A", status: "На проверке", user: "student" }, { assignment: "B", status: "Проверено", user: "student" }];
assert.deepEqual(submissionStats(assignments, submissions, new Date("2026-10-27T12:00:00")), { assigned: 2, sent: 2, reviewed: 1, pending: 1, overdue: 1 });
assert.equal(learningStreak([{ createdAt: "2026-10-27T09:00:00Z" }, { createdAt: "2026-10-26T09:00:00Z" }], new Date("2026-10-27T12:00:00Z")), 2);
console.log("dashboard tests passed");
