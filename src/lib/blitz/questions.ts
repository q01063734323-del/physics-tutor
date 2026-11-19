import { baseLatex, concepts, formulaById, formulas, quantities, type Formula } from "./catalog";

export type Mode = "classic" | "guess" | "assemble" | "unknown" | "units" | "traps" | "flash" | "mistakes" | "exam" | "timed";
export type Question = {
  id: string; learningId: string; kind: "formula" | "assemble" | "unknown" | "unit" | "dimension" | "conversion" | "concept" | "trap";
  sections: string[]; topics: string[]; difficulty: number; prompt: string; context: string;
  choices: string[]; correct: string; explanation: string; formulaId?: string; quantityId?: string; source: string;
};
export type Settings = { mode: Mode; sections: string[]; topics: string[]; content: "mixed" | "formulas" | "units"; difficulty: number; count: number | "all" };
export const defaultSettings: Settings = { mode: "classic", sections: [], topics: [], content: "mixed", difficulty: 0, count: 20 };
const math = (latex: string) => `$${latex}$`;
const unique = (values: string[]) => [...new Set(values)];

function alternatives(correct: string, candidates: string[]) {
  const result = [correct, ...unique(candidates).filter(value => value !== correct)].slice(0, 4);
  if (result.length !== 4) throw new Error(`Four distinct alternatives required: ${correct}`);
  return result;
}

const unknownErrors: Record<string, string[]> = {
  "uniform-time": ["t=sv", "t=v/s", "t=s/v^2"], "uniform-speed": ["v=st", "v=t/s", "v=s/t^2"],
  "mass-density": ["m=\\rho/V", "m=V/\\rho", "m=\\rho V^2"], "volume-density": ["V=m\\rho", "V=\\rho/m", "V=m/\\rho^2"],
  "newton-acceleration": ["a=Fm", "a=m/F", "a=F^2/m"], "newton-mass": ["m=Fa", "m=a/F", "m=F/a^2"],
  stiffness: ["k=F\\lvert x\\rvert", "k=\\lvert x\\rvert/F", "k=F/x^2"],
  "pressure-force": ["F=p/S", "F=S/p", "F=pS^2"], "momentum-speed": ["v=pm", "v=m/p", "v=p/m^2"],
  "kinetic-speed": ["v=\\sqrt{E_k/(2m)}", "v=2E_k/m", "v=\\sqrt{2mE_k}"],
  "pendulum-length": ["l=gT^2/(2\\pi)", "l=4\\pi^2g/T^2", "l=T^2/g"],
  "gas-density": ["\\rho=pRT/M", "\\rho=RT/(pM)", "\\rho=pMRT"],
  "gas-temperature": ["T=pV\\nu R", "T=\\nu R/(pV)", "T=p/(V\\nu R)"],
  "specific-heat": ["c=Qm/\\Delta T", "c=Q\\Delta T/m", "c=m\\Delta T/Q"],
  "first-law-energy": ["\\Delta U=Q+A", "\\Delta U=A-Q", "\\Delta U=QA"],
  "field-force": ["F=E/q", "F=q/E", "F=q^2E"], "capacitor-charge": ["q=C/U", "q=U/C", "q=CU^2"],
  "series-capacity-pair": ["C=C_1+C_2", "C=C_1C_2", "C=(C_1+C_2)/(C_1C_2)"],
  "ohm-voltage": ["U=I/R", "U=R/I", "U=I^2R"], "ohm-resistance": ["R=UI", "R=I/U", "R=U/I^2"],
  "wire-resistivity": ["\\rho_e=Rl/S", "\\rho_e=l/(RS)", "\\rho_e=RSl"],
  "parallel-resistance-pair": ["R=R_1+R_2", "R=R_1R_2", "R=(R_1+R_2)/(R_1R_2)"],
  "magnetic-induction": ["B=F_AIl", "B=Il/F_A", "B=F_AI/l"],
  "lc-frequency": ["\\nu=2\\pi\\sqrt{LC}", "\\nu=\\sqrt{LC}/(2\\pi)", "\\nu=1/\\sqrt{LC}"],
  "lens-image-distance": ["f=Fd/(d+F)", "f=(d-F)/(Fd)", "f=d-F"],
};

function formulaQuestion(formula: Formula): Question {
  const similar = formulas.filter(other => other.id !== formula.id && other.topic === formula.topic);
  const choices = alternatives(math(formula.latex), [...similar, ...formulas].map(other => math(other.latex)));
  return { id: `formula:${formula.id}`, learningId: `formula:${formula.id}`, kind: "formula", sections: [formula.section], topics: [formula.topic],
    difficulty: formula.difficulty, prompt: `Выбери запись: ${formula.title.toLowerCase()}.`, context: formula.conditions,
    choices, correct: math(formula.latex), explanation: `${formula.title}: ${math(formula.latex)}. ${formula.conditions}`,
    formulaId: formula.id, source: `ФИПИ-2027 · ${formula.code} · ${formula.kind === "derive" ? "вывод/применение" : formula.provided ? "справочные данные" : "кодификатор"}` };
}

const questions: Question[] = formulas.map(formulaQuestion);
for (const formula of formulas) {
  const parts = formula.latex.split("=");
  if (parts.length === 2) {
    const candidates = [...formulas.filter(other => other.topic === formula.topic), ...formulas].flatMap(other => other.latex.split("=").length === 2 ? [math(other.latex.split("=")[1])] : []);
    questions.push({ ...formulaQuestion(formula), id: `assemble:${formula.id}`, kind: "assemble", prompt: `${formula.title}. Восстанови правую часть: ${math(parts[0] + "=?")}`,
      choices: alternatives(math(parts[1]), candidates), correct: math(parts[1]) });
  }
  const base = formula.related.length ? formulaById.get(formula.related[0]) : null;
  const wrong = unknownErrors[formula.id];
  if (base && wrong) questions.push({ ...formulaQuestion(formula), id: `unknown:${formula.id}`, kind: "unknown", difficulty: Math.max(2, formula.difficulty),
    prompt: `Из ${math(base.latex)} получи: ${formula.title.toLowerCase()}.`, context: `${formula.conditions} Вырази через величины исходного соотношения.`,
    choices: alternatives(math(formula.latex), wrong.map(math)), correct: math(formula.latex),
    explanation: `Преобразование ${math(base.latex)} даёт ${math(formula.latex)}. ${formula.conditions}` });
}

const unitMistakes: Record<string, string[]> = {
  acceleration: ["м/с", "Н", "Дж"], speed: ["м/с²", "м", "Гц"], force: ["кг", "Дж", "Па"], energy: ["Вт", "Н", "К"],
  power: ["Дж", "Н", "Ом"], pressure: ["Н", "кг/м³", "Дж"], density: ["Па", "кг·м³", "м³/кг"],
  capacitance: ["Кл", "В", "Гн"], "magnetic-flux": ["Тл", "Гн", "В"], inductance: ["Ф", "Гц", "Вб"],
  voltage: ["А", "Ом", "Кл"], charge: ["А", "В", "Ф"], resistance: ["А", "В", "См"],
  "specific-heat": ["Дж/К", "Дж/кг", "Дж"], "temperature": ["°C", "Дж", "моль"],
};
for (const quantity of quantities) {
  const related = quantity.relatedFormulas.flatMap(id => formulaById.get(id) || []);
  const sections = unique(related.map(formula => formula.section));
  const topics = unique(related.map(formula => formula.topic));
  const common = { learningId: `unit:${quantity.id}`, sections: sections.length ? sections : ["Основы СИ"], topics: topics.length ? topics : ["Основные единицы СИ"],
    quantityId: quantity.id, context: math(quantity.symbol), explanation: `${quantity.name}: ${quantity.unit}; ${math(baseLatex(quantity.baseSI))}. ${quantity.mistake}`, source: "Международная система СИ · BIPM" };
  questions.push({ ...common, id: `unit:${quantity.id}`, kind: "unit", difficulty: 1, prompt: `Какое принятое обозначение единицы СИ: ${quantity.name.toLowerCase()}?`,
    choices: alternatives(quantity.unit, [...(unitMistakes[quantity.id] || []), ...quantities.map(other => other.unit)]), correct: quantity.unit });
  questions.push({ ...common, id: `dimension:${quantity.id}`, kind: "dimension", difficulty: 3, prompt: `Вырази единицу «${quantity.name.toLowerCase()}» через основные единицы СИ.`,
    choices: alternatives(math(baseLatex(quantity.baseSI)), quantities.map(other => math(baseLatex(other.baseSI)))), correct: math(baseLatex(quantity.baseSI)) });
}

const trapConcepts = new Set(["saturated-vapor", "phase-energy", "thermal-equilibrium", "second-law", "lenz", "photoelectric-laws", "dispersion", "diverging-lens", "gamma-decay", "ideal-gas-model"]);
for (const concept of concepts) questions.push({ id: `concept:${concept.id}`, learningId: `concept:${concept.id}`, kind: trapConcepts.has(concept.id) ? "trap" : "concept",
  sections: [concept.section], topics: [concept.topic], difficulty: trapConcepts.has(concept.id) ? 3 : 2,
  prompt: concept.prompt, context: "Выбери одно физически верное утверждение.", choices: alternatives(concept.correct, concept.distractors), correct: concept.correct,
  explanation: concept.explanation, source: `ФИПИ-2027 · ${concept.code} · качественная модель` });

const prefixes = [["гига", "Г", 9], ["мега", "М", 6], ["кило", "к", 3], ["гекто", "г", 2], ["деци", "д", -1], ["санти", "с", -2], ["милли", "м", -3], ["микро", "мк", -6], ["нано", "н", -9], ["пико", "п", -12]] as const;
export const examPrefixes = prefixes;
function numberText(value: number) {
  const text = Number(value.toPrecision(10)).toString();
  const [mantissa, exponent] = text.split("e");
  return exponent === undefined ? text.replace(".", ",") : math(`${mantissa.replace(".", "{,}")}\\cdot10^{${Number(exponent)}}`);
}
function conversion(id: string, value: number, from: string, to: string, factor: number, quantityId: string, extra = "", offset = 0, difficulty = 2) {
  const quantity = quantities.find(item => item.id === quantityId)!;
  const related = quantity.relatedFormulas.flatMap(id => formulaById.get(id) || []);
  const expected = value * factor + offset;
  const correct = numberText(expected);
  const candidates = expected === 0 ? ["273", "273,15", "-273", "1"] : [expected * 10, expected / 10, expected * 1000, expected / 1000, value + offset, value].map(numberText);
  questions.push({ id: `conversion:${id}`, learningId: `unit:${quantityId}`, kind: "conversion", quantityId,
    sections: unique(related.map(item => item.section)), topics: unique(related.map(item => item.topic)), difficulty,
    prompt: `Переведи ${numberText(value)} ${from} в ${to}.`, context: extra || "Выбери числовое значение в указанных единицах.",
    choices: alternatives(correct, candidates), correct,
    explanation: `${numberText(value)} ${from} = ${correct} ${to}. ${offset ? `Использован сдвиг ${numberText(offset)}.` : `Множитель перевода: ${numberText(factor)}.`} ${extra}`,
    source: "СИ · приставки; справочные материалы демоверсии ФИПИ-2027" });
}
for (const [index, [, prefix, exponent]] of prefixes.entries()) {
  for (const [unit, id] of [["Н", "force"], ["В", "voltage"], ["А", "current"], ["Ом", "resistance"], ["Ф", "capacitance"], ["Гн", "inductance"], ["Гц", "frequency"], ["Па", "pressure"], ["Дж", "energy"], ["Вт", "power"], ["Кл", "charge"], ["м", "length"]]) {
    conversion(`prefix-${exponent}-${id}`, [2, 5, 12][index % 3], prefix + unit, unit, 10 ** exponent, id);
  }
}
for (const [name, prefix, exponent] of [["mm", "мм", -3], ["cm", "см", -2], ["dm", "дм", -1], ["km", "км", 3]] as const) {
  conversion(`${name}-square`, 5, `${prefix}²`, "м²", 10 ** (2 * exponent), "area", "Приставка возводится в квадрат вместе с единицей.", 0, 3);
  conversion(`${name}-cube`, 2, `${prefix}³`, "м³", 10 ** (3 * exponent), "volume", "Приставка возводится в куб вместе с единицей.", 0, 3);
}
conversion("speed-72", 72, "км/ч", "м/с", 1 / 3.6, "speed");
conversion("speed-54", 54, "км/ч", "м/с", 1 / 3.6, "speed");
conversion("speed-back", 20, "м/с", "км/ч", 3.6, "speed");
conversion("mass-250", 250, "г", "кг", .001, "mass");
conversion("mass-mg", 5, "мг", "кг", 1e-6, "mass", "Миллиграмм — 10⁻³ грамма и 10⁻⁶ килограмма.", 0, 3);
conversion("mass-tonne", 2, "т", "кг", 1000, "mass");
conversion("molar-mass", 28, "г/моль", "кг/моль", .001, "molar-mass");
conversion("minutes", 5, "мин", "с", 60, "time");
conversion("hours", 2, "ч", "с", 3600, "time");
conversion("litres", 3, "л", "м³", .001, "volume");
conversion("millilitres", 250, "мл", "м³", 1e-6, "volume", "Миллилитр равен кубическому сантиметру.", 0, 3);
conversion("density-cgs", 1, "г/см³", "кг/м³", 1000, "density", "Переводят одновременно массу и кубическую единицу объёма.", 0, 3);
conversion("density-gl", 5, "г/л", "кг/м³", 1, "density", "В числителе и знаменателе появляется одинаковый множитель 10⁻³.", 0, 3);
conversion("energy-kwh", 2, "кВт·ч", "Дж", 3.6e6, "energy", "Киловатт-час — единица энергии, не мощности.", 0, 3);
conversion("energy-ev", 5, "эВ", "Дж", 1.6e-19, "energy", "Экзаменационное соотношение 1 эВ = 1,6·10⁻¹⁹ Дж.", 0, 3);
conversion("energy-mev", 2, "МэВ", "Дж", 1.6e-13, "energy", "Дополнительно учитывается множитель мега.", 0, 3);
conversion("temp-zero", 0, "°C", "К", 1, "temperature", "Используй экзаменационное округление T = t + 273.", 273);
conversion("temp-room", 27, "°C", "К", 1, "temperature", "Используй экзаменационное округление 273.", 273);
conversion("temp-negative", -73, "°C", "К", 1, "temperature", "Используй экзаменационное округление 273.", 273);
conversion("temp-back", 273, "К", "°C", 1, "temperature", "Используй экзаменационное округление 273.", -273);
conversion("temp-difference", 20, "°C изменения температуры", "К изменения температуры", 1, "temperature", "К разности температур не прибавляют 273.", 0, 3);
conversion("percentage", 80, "% КПД", "доли единицы", .01, "coefficient");
conversion("revolutions", 30, "об/мин", "Гц", 1 / 60, "frequency");

export const allQuestions: Question[] = questions;
export const questionById = new Map(allQuestions.map(question => [question.id, question]));

export function filterQuestions(settings: Settings, mistakes: string[] = []): Question[] {
  return allQuestions.filter(question => {
    if (settings.sections.length && !question.sections.some(section => settings.sections.includes(section))) return false;
    if (settings.topics.length && !question.topics.some(topic => settings.topics.includes(topic))) return false;
    if (settings.difficulty && question.difficulty !== settings.difficulty) return false;
    const unit = ["unit", "dimension", "conversion"].includes(question.kind);
    if (settings.content === "formulas" && unit || settings.content === "units" && !unit) return false;
    if (settings.mode === "mistakes") return mistakes.includes(question.id);
    if (settings.mode === "guess") return question.kind === "formula";
    if (settings.mode === "assemble") return question.kind === "assemble";
    if (settings.mode === "flash") return question.kind === "formula" || question.kind === "unit";
    if (settings.mode === "unknown") return question.kind === "unknown";
    if (settings.mode === "units") return unit;
    if (settings.mode === "traps") return question.kind === "trap" || question.kind === "conversion" && question.difficulty === 3 || question.kind === "dimension";
    return question.kind !== "unknown" && question.kind !== "assemble";
  });
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items]; let value = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; const j = value % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
