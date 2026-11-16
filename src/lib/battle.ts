export type BattleExam = "ОГЭ" | "ЕГЭ";
export type BattleMode = "speed" | "formulas" | "mistake" | "streak" | "boss";
export type BattleTopic = "Механика" | "Молекулярная физика" | "Термодинамика" | "Электродинамика" | "Магнитное поле" | "Оптика" | "Квантовая физика";

export type BattleQuestion = {
  id: string;
  topic: BattleTopic;
  mode: BattleMode;
  difficulty: 1 | 2 | 3;
  prompt: string;
  answer: string;
  explanation: string;
  formula: string;
  mistake?: string;
};

export type BattleAttempt = {
  id: string;
  questionId: string;
  topic: BattleTopic;
  mode: BattleMode;
  correct: boolean;
  difficulty: number;
  score: number;
  createdAt: string;
};

export type TopicProgress = {
  attempts: number;
  correct: number;
  recent: number[];
};

export type BattleProfile = {
  exam: BattleExam;
  xp: number;
  coins: number;
  streak: number;
  bestStreak: number;
  dailyCompleted: number;
  dailyGoal: number;
  attempts: BattleAttempt[];
  topics: Record<BattleTopic, TopicProgress>;
  achievements: string[];
  lastActive: string;
};

export const battleTopics: Array<{ name: BattleTopic; eyebrow: string; description: string; accent: string; symbol: string }> = [
  { name: "Механика", eyebrow: "01", description: "Силы, движение и энергия", accent: "#66d7ff", symbol: "↗" },
  { name: "Молекулярная физика", eyebrow: "02", description: "Газовые законы и модели", accent: "#9d8cff", symbol: "◌" },
  { name: "Термодинамика", eyebrow: "03", description: "Тепло, работа и процессы", accent: "#ffba72", symbol: "∿" },
  { name: "Электродинамика", eyebrow: "04", description: "Ток, цепи и мощность", accent: "#58e5ae", symbol: "⌁" },
  { name: "Магнитное поле", eyebrow: "05", description: "Индукция и сила Ампера", accent: "#ff7fa7", symbol: "⊙" },
  { name: "Оптика", eyebrow: "06", description: "Линзы и волновые явления", accent: "#f7e37e", symbol: "◐" },
  { name: "Квантовая физика", eyebrow: "07", description: "Фотоны и атомное ядро", accent: "#b8f28e", symbol: "✦" },
];

export const battleModes: Array<{ id: BattleMode; title: string; description: string; meta: string; icon: string; accent: string }> = [
  { id: "speed", title: "Скоростной раунд", description: "Пять задач. Один ритм. Решай быстрее и точнее.", meta: "5 задач · 03:00", icon: "↯", accent: "#66d7ff" },
  { id: "formulas", title: "Битва формул", description: "Выбери физический закон и собери решение без лишних шагов.", meta: "Формулы · XP × 1.2", icon: "∑", accent: "#9d8cff" },
  { id: "mistake", title: "Найди ошибку", description: "Разбери чужое решение и поймай момент, где ломается логика.", meta: "Разбор · XP × 1.3", icon: "⌁", accent: "#ffba72" },
  { id: "streak", title: "Серия без ошибок", description: "Каждый правильный ответ открывает следующий уровень сложности.", meta: "До первой ошибки", icon: "◈", accent: "#58e5ae" },
  { id: "boss", title: "Экзаменационный босс", description: "Мини-пробник в режиме экзамена с честным итоговым прогнозом.", meta: "6 задач · 12:00", icon: "♜", accent: "#ff7fa7" },
];

export const battleQuestions: BattleQuestion[] = [
  { id: "mechanics-force", topic: "Механика", mode: "speed", difficulty: 1, prompt: "Сила 12 Н сообщает телу массой 3 кг ускорение. Найди ускорение.", answer: "4", explanation: "По второму закону Ньютона a = F / m = 12 / 3 = 4 м/с².", formula: "a = F / m" },
  { id: "mechanics-energy", topic: "Механика", mode: "streak", difficulty: 2, prompt: "Камень массой 2 кг подняли на 5 м. g = 10 Н/кг. Найди потенциальную энергию.", answer: "100", explanation: "Eₚ = mgh = 2 · 10 · 5 = 100 Дж.", formula: "Eₚ = mgh" },
  { id: "mechanics-speed", topic: "Механика", mode: "boss", difficulty: 1, prompt: "Тело движется со скоростью 20 м/с. Какой путь оно пройдёт за 5 с?", answer: "100", explanation: "При равномерном движении s = vt = 20 · 5 = 100 м.", formula: "s = vt" },
  { id: "molecular-density", topic: "Молекулярная физика", mode: "formulas", difficulty: 2, prompt: "Масса вещества 600 г, объём 200 см³. Найди плотность в г/см³.", answer: "3", explanation: "ρ = m / V = 600 / 200 = 3 г/см³.", formula: "ρ = m / V" },
  { id: "thermo-heat", topic: "Термодинамика", mode: "boss", difficulty: 2, prompt: "Сколько теплоты нужно для нагревания 2 кг воды на 10 °C? c = 4200 Дж/(кг·°C).", answer: "84000", explanation: "Q = cmΔt = 4200 · 2 · 10 = 84 000 Дж.", formula: "Q = cmΔt" },
  { id: "thermo-error", topic: "Термодинамика", mode: "mistake", difficulty: 2, prompt: "Ученик решил задачу так: Q = c · Δt / m. Где ошибка?", answer: "m", explanation: "Масса должна умножаться на удельную теплоёмкость и изменение температуры.", formula: "Q = cmΔt", mistake: "Массу нельзя переносить в знаменатель." },
  { id: "electric-ohm", topic: "Электродинамика", mode: "speed", difficulty: 1, prompt: "Напряжение 12 В, сопротивление 6 Ом. Найди силу тока.", answer: "2", explanation: "По закону Ома I = U / R = 12 / 6 = 2 А.", formula: "I = U / R" },
  { id: "electric-power", topic: "Электродинамика", mode: "formulas", difficulty: 2, prompt: "Ток 3 А проходит через сопротивление 4 Ом. Найди мощность.", answer: "36", explanation: "P = I²R = 3² · 4 = 36 Вт.", formula: "P = I²R" },
  { id: "magnetic-force", topic: "Магнитное поле", mode: "boss", difficulty: 3, prompt: "Как изменится сила Ампера, если ток увеличить в 2 раза, а длину проводника оставить прежней?", answer: "2", explanation: "F = BIl, поэтому при удвоении I сила увеличится в 2 раза.", formula: "F = BIl" },
  { id: "optics-lens", topic: "Оптика", mode: "streak", difficulty: 2, prompt: "Фокусное расстояние линзы 0,2 м. Найди оптическую силу.", answer: "5", explanation: "D = 1 / F = 1 / 0,2 = 5 дптр.", formula: "D = 1 / F" },
  { id: "quantum-photon", topic: "Квантовая физика", mode: "boss", difficulty: 3, prompt: "Что происходит с энергией фотона при увеличении частоты излучения?", answer: "увеличивается", explanation: "Энергия фотона E = hν и прямо пропорциональна частоте.", formula: "E = hν" },
  { id: "optics-error", topic: "Оптика", mode: "mistake", difficulty: 2, prompt: "В решении написано: D = F. Какая формула нужна для оптической силы?", answer: "1/F", explanation: "Оптическая сила равна величине, обратной фокусному расстоянию в метрах.", formula: "D = 1 / F", mistake: "Фокусное расстояние и оптическая сила — взаимно обратные величины." },
];

// Additional short rounds cover the full set of advertised modes.
battleQuestions.push(
  { id: "speed-distance", topic: "Механика", mode: "speed", difficulty: 1, prompt: "Велосипедист едет со скоростью 6 м/с. Какой путь в метрах он пройдёт за 20 с?", answer: "120", explanation: "При равномерном движении s = vt = 6 · 20 = 120 м.", formula: "s = vt" },
  { id: "speed-lens", topic: "Оптика", mode: "speed", difficulty: 1, prompt: "Фокусное расстояние собирающей линзы 0,5 м. Найди оптическую силу в диоптриях.", answer: "2", explanation: "D = 1/F = 1/0,5 = 2 дптр.", formula: "D = 1/F" },
  { id: "speed-heat", topic: "Термодинамика", mode: "speed", difficulty: 1, prompt: "Тело получило 300 Дж теплоты и совершило работу 100 Дж. На сколько джоулей увеличилась его внутренняя энергия?", answer: "200", explanation: "По первому закону термодинамики ΔU = Q − A = 300 − 100 = 200 Дж.", formula: "ΔU = Q − A" },
  { id: "formula-acceleration", topic: "Механика", mode: "formulas", difficulty: 1, prompt: "Вырази ускорение a из второго закона Ньютона F = ma. Введи правую часть формулы.", answer: "F/m", explanation: "Разделим обе части равенства на массу. Получим a = F/m.", formula: "a = F/m" },
  { id: "formula-temperature", topic: "Термодинамика", mode: "formulas", difficulty: 2, prompt: "Вырази изменение температуры из Q = cmΔT. Введи правую часть формулы через Q, c и m.", answer: "Q/(c*m)", explanation: "Чтобы найти ΔT, разделим Q на произведение c и m.", formula: "ΔT = Q/(cm)" },
  { id: "formula-ohm", topic: "Электродинамика", mode: "formulas", difficulty: 1, prompt: "Из закона Ома I = U/R вырази напряжение U. Введи правую часть формулы.", answer: "I*R", explanation: "Умножим обе части равенства на R. Получим U = IR.", formula: "U = IR" },
  { id: "mistake-speed", topic: "Механика", mode: "mistake", difficulty: 1, prompt: "Ученик перевёл 72 км/ч в м/с и получил 72 · 3,6. Запиши правильное числовое значение скорости в м/с.", answer: "20", explanation: "Для перевода километров в час в метры в секунду нужно разделить на 3,6. Получим 20 м/с.", formula: "v = 72/3,6 = 20 м/с" },
  { id: "mistake-power", topic: "Электродинамика", mode: "mistake", difficulty: 2, prompt: "Для тока 2 А и сопротивления 3 Ом ученик получил мощность 6 Вт. Найди правильную мощность в ваттах.", answer: "12", explanation: "В формуле мощности ток возводится в квадрат. P = I²R = 4 · 3 = 12 Вт.", formula: "P = I²R" },
  { id: "mistake-density", topic: "Молекулярная физика", mode: "mistake", difficulty: 1, prompt: "Плотность записали как ρ = V/m. Введи правильную правую часть формулы.", answer: "m/V", explanation: "Плотность равна массе единицы объёма, поэтому массу делят на объём.", formula: "ρ = m/V" },
  { id: "streak-pressure", topic: "Молекулярная физика", mode: "streak", difficulty: 1, prompt: "Сила давления 60 Н действует на площадь 2 м². Найди давление в паскалях.", answer: "30", explanation: "p = F/S = 60/2 = 30 Па.", formula: "p = F/S" },
  { id: "streak-work", topic: "Механика", mode: "streak", difficulty: 2, prompt: "Сила 15 Н перемещает тело на 4 м вдоль направления силы. Найди работу в джоулях.", answer: "60", explanation: "A = Fs = 15 · 4 = 60 Дж.", formula: "A = Fs" },
  { id: "streak-magnetic", topic: "Магнитное поле", mode: "streak", difficulty: 3, prompt: "Проводник длиной 0,2 м с током 5 А расположен перпендикулярно полю 0,4 Тл. Найди силу Ампера в ньютонах.", answer: "0.4", explanation: "При перпендикулярном расположении F = BIl = 0,4 · 5 · 0,2 = 0,4 Н.", formula: "F = BIl" },
  { id: "streak-photon", topic: "Квантовая физика", mode: "streak", difficulty: 3, prompt: "Во сколько раз увеличится энергия фотона, если частоту излучения увеличить в 3 раза?", answer: "3", explanation: "E = hν, поэтому энергия прямо пропорциональна частоте.", formula: "E = hν" },
);

export function emptyTopicProgress(): TopicProgress { return { attempts: 0, correct: 0, recent: [] }; }

export function createBattleProfile(exam: BattleExam = "ЕГЭ"): BattleProfile {
  return {
    exam, xp: 0, coins: 0, streak: 0, bestStreak: 0, dailyCompleted: 0, dailyGoal: 10,
    attempts: [], achievements: [], lastActive: new Date().toISOString(),
    topics: Object.fromEntries(battleTopics.map(topic => [topic.name, emptyTopicProgress()])) as Record<BattleTopic, TopicProgress>,
  };
}

export function levelForXp(xp: number) {
  return Math.max(1, Math.floor(xp / 250) + 1);
}

export function xpToNextLevel(xp: number) {
  const level = levelForXp(xp);
  return { level, current: xp - (level - 1) * 250, needed: 250 };
}

export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replaceAll(",", ".").replace(/\s+/g, "")
    .replace(/[·×]/g, "*").replace(/\*/g, "");
}

export function answerIsCorrect(question: BattleQuestion, value: string) {
  const actual = normalizeAnswer(value);
  const expected = normalizeAnswer(question.answer);
  if (!actual) return false;
  if (actual === expected) return true;
  const numericActual = Number(actual);
  const numericExpected = Number(expected);
  return Number.isFinite(numericActual) && Number.isFinite(numericExpected) && Math.abs(numericActual - numericExpected) < 0.0001;
}

export function estimateForecast(profile: BattleProfile) {
  const attempts = profile.attempts;
  if (attempts.length < 5) return { ready: false, score: 0, low: 0, high: 0, confidence: 0, label: "Недостаточно данных" };
  const weightedTotal = attempts.reduce((sum, item) => sum + item.difficulty, 0);
  const weightedCorrect = attempts.reduce((sum, item) => sum + (item.correct ? item.difficulty : 0), 0);
  const quality = weightedTotal ? weightedCorrect / weightedTotal : 0;
  const mockAttempts = attempts.filter(item => item.mode === "boss").length;
  const base = profile.exam === "ЕГЭ" ? 35 : 20;
  const score = Math.round(base + quality * (100 - base));
  const coverage = new Set(attempts.map(item => item.topic)).size;
  const confidence = Math.min(85, 20 + Math.min(attempts.length, 30) + coverage * 4 + Math.min(mockAttempts, 7));
  const spread = Math.max(4, Math.round(18 - confidence / 8));
  return { ready: true, score, low: Math.max(base, score - spread), high: Math.min(100, score + spread), confidence, label: "Ориентир по практике" };
}

export function buildPlan(profile: BattleProfile) {
  return battleTopics
    .map(topic => ({ ...topic, stats: profile.topics[topic.name] }))
    .sort((a, b) => {
      const aRate = a.stats.attempts ? a.stats.correct / a.stats.attempts : 0;
      const bRate = b.stats.attempts ? b.stats.correct / b.stats.attempts : 0;
      return aRate - bRate;
    })
    .slice(0, 3)
    .map(topic => ({ topic: topic.name, rate: topic.stats.attempts ? Math.round(topic.stats.correct / topic.stats.attempts * 100) : 0, text: topic.stats.attempts ? "Закрепить слабое место" : "Открыть тему и начать маршрут" }));
}

export function recordBattleAttempt(profile: BattleProfile, question: BattleQuestion, correct: boolean): BattleProfile {
  const now = new Date().toISOString();
  const stats = profile.topics[question.topic] || emptyTopicProgress();
  const nextStreak = correct ? profile.streak + 1 : 0;
  const multiplier = question.mode === "boss" ? 1.5 : question.mode === "mistake" ? 1.3 : question.mode === "formulas" ? 1.2 : 1;
  const score = correct ? Math.round((40 + question.difficulty * 25) * multiplier) : 0;
  const attempt: BattleAttempt = { id: `${question.id}-${Date.now()}`, questionId: question.id, topic: question.topic, mode: question.mode, correct, difficulty: question.difficulty, score, createdAt: now };
  return {
    ...profile,
    xp: profile.xp + score,
    coins: profile.coins + (correct ? 4 + question.difficulty : 0),
    streak: nextStreak,
    bestStreak: Math.max(profile.bestStreak, nextStreak),
    dailyCompleted: (profile.lastActive.slice(0, 10) === now.slice(0, 10) ? profile.dailyCompleted : 0) + 1,
    achievements: Array.from(new Set([
      ...profile.achievements,
      ...(correct ? ["Первый верный ответ"] : []),
      ...(nextStreak >= 5 ? ["Пять подряд"] : []),
      ...(profile.xp + score >= 1000 ? ["Тысяча XP"] : []),
      ...(question.mode === "boss" && correct ? ["Шаг к экзамену"] : []),
    ])),
    attempts: [...profile.attempts, attempt].slice(-120),
    topics: { ...profile.topics, [question.topic]: { attempts: stats.attempts + 1, correct: stats.correct + (correct ? 1 : 0), recent: [...stats.recent, correct ? 1 : 0].slice(-8) } },
    lastActive: now,
  };
}
