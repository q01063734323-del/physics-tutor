export interface FormulaCheckResult {
  isValid: boolean;
  normalizedInput: string;
  matchedFormula?: string;
  feedback?: string;
}

type FormulaDefinition = { label: string; equivalents: string[] };

const formulas: Record<string, FormulaDefinition> = {
  ohm: { label: "Закон Ома: I = U/R", equivalents: ["I=U/R", "U/R=I", "U=I*R", "U=R*I", "R=U/I", "R=U/I"] },
  newton2: { label: "Второй закон Ньютона: F = m*a", equivalents: ["F=m*a", "F=a*m", "a=F/m", "m=F/a"] },
  heat: { label: "Количество теплоты: Q = c*m*Δt", equivalents: ["Q=c*m*dt", "Q=m*c*dt", "m=Q/(c*dt)", "c=Q/(m*dt)", "dt=Q/(c*m)"] },
  kinetic: { label: "Кинетическая энергия: E = m*v²/2", equivalents: ["E=m*v^2/2", "E=v^2*m/2", "m=2*E/v^2", "v^2=2*E/m"] },
  density: { label: "Плотность: ρ = m/V", equivalents: ["rho=m/V", "p=m/V", "m=rho*V", "V=m/rho"] },
  power: { label: "Мощность тока: P = U*I", equivalents: ["P=U*I", "P=I*U", "U=P/I", "I=P/U"] },
  speed: { label: "Скорость: v = s/t", equivalents: ["v=s/t", "s=v*t", "t=s/v"] },
};

const cyrillicAliases: Record<string, string> = { "с": "c", "а": "a", "р": "p", "е": "e", "х": "x", "у": "y", "о": "o", "м": "m", "т": "t", "д": "d", "ф": "f", "к": "k", "л": "l", "н": "n", "в": "v" };

export function normalizeFormula(value: string): string {
  let normalized = value.normalize("NFKC").toLowerCase().replace(/[сарехуомтдфклнв]/g, char => cyrillicAliases[char] || char);
  normalized = normalized.replace(/[∆δ]t/g, "dt").replace(/[∆δ]/g, "d").replace(/[·×*]/g, "*").replace(/[/:÷]/g, "/");
  normalized = normalized.replace(/\s+/g, "").replace(/[{}\[\]]/g, "(");
  normalized = normalized.replace(/\)+/g, ")").replace(/\(([^()]*)\)/g, "$1");
  return normalized;
}

function canonicalExpression(expression: string): string {
  const [left, right] = expression.split("=");
  if (!left || !right || expression.split("=").length !== 2) return expression;
  const normalizeSide = (side: string) => side.split("/").map(part => part.split("*").sort().join("*")).join("/");
  return `${normalizeSide(left)}=${normalizeSide(right)}`;
}

export function validateFormula(userInput: string, formulaId: string): FormulaCheckResult {
  const normalizedInput = normalizeFormula(userInput);
  const definition = formulas[formulaId];
  if (!definition) return { isValid: false, normalizedInput, feedback: "Формула с таким идентификатором не найдена." };
  const inputCanonical = canonicalExpression(normalizedInput);
  const matched = definition.equivalents.find(candidate => canonicalExpression(normalizeFormula(candidate)) === inputCanonical);
  return matched
    ? { isValid: true, normalizedInput, matchedFormula: matched, feedback: `Верно: ${definition.label}.` }
    : { isValid: false, normalizedInput, feedback: "Запись не совпала с допустимой формой. Проверь знак равенства, деление и обозначения величин." };
}

export const formulaDefinitions = formulas;
