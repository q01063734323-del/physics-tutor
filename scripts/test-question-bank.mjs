import assert from "node:assert/strict";
import { importedQuestionBank, egeTopics } from "../src/lib/question-bank.ts";

assert.equal(importedQuestionBank.length, 50, "банк должен содержать 50 задач");
assert.equal(new Set(importedQuestionBank.map((question) => question.id)).size, importedQuestionBank.length, "идентификаторы задач должны быть уникальными");
assert.ok(importedQuestionBank.every((question) => egeTopics.includes(question.topic)), "тема каждой задачи должна быть в справочнике ЕГЭ");
assert.ok(importedQuestionBank.every((question) => question.prompt && question.answer && question.hint && question.solution), "у каждой задачи должны быть условие, ответ, подсказка и решение");
assert.ok(importedQuestionBank.every((question) => question.verification === "verified"), "статические задачи должны быть проверены перед показом ученику");

console.log("question bank tests passed");
