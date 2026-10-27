export type BankQuestion = {
  id: string;
  topic: string;
  subtopic: string;
  exam: "ЕГЭ" | "ОГЭ";
  answerType: "numeric" | "choice";
  prompt: string;
  answer: string;
  hint: string;
  solution: string;
  source: string;
  verification: "verified" | "needs_review";
};

export const importedQuestionBank: BankQuestion[] = [
  {
    id: "pdf-ege-004",
    topic: "Механические колебания и волны",
    subtopic: "Звуковые волны",
    exam: "ЕГЭ",
    answerType: "numeric",
    prompt: "Колеблющаяся струна издаёт звук с длиной волны 0,17 м. Какова частота её колебаний, если скорость звука в воздухе 340 м/с? Ответ запишите в герцах.",
    answer: "2000",
    hint: "Используй связь скорости, длины волны и частоты: v = λν.",
    solution: "ν = v/λ = 340/0,17 = 2000 Гц.",
    source: "Физика ЕГЭ 2026, присланный DOCX, страница PDF 4, задание 4",
    verification: "verified",
  },
];
