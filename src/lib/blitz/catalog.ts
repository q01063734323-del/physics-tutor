import data from "../../../data/blitz/catalog.json";

export type Formula = {
  id: string; code: string; section: string; topic: string; title: string; latex: string;
  variables: { symbol: string; quantityId: string; name: string; unit: string }[];
  conditions: string; difficulty: number; kind: "law" | "derive" | "provided"; related: string[];
  source: { url: string; document: string; printedPage: number; status: string }; provided: boolean; mistake: string;
};
export type Quantity = { id: string; name: string; symbol: string; unit: string; baseSI: string; dimension: number[]; mistake: string; relatedFormulas: string[]; source: string };
export type Concept = { id: string; code: string; section: string; topic: string; prompt: string; correct: string; distractors: string[]; explanation: string; source: { url: string; printedPage: number } };
export const formulas = data.formulas as Formula[];
export const quantities = data.quantities as Quantity[];
export const concepts = data.concepts as Concept[];
export const groups = data.groups;
export const codifier = data.source;
export const catalogVersion = data.version;
export const sections = [...new Set(groups.map(group => group.section))];
export const formulaById = new Map(formulas.map(formula => [formula.id, formula]));
export const quantityById = new Map(quantities.map(quantity => [quantity.id, quantity]));

export const examConstants = [
  ["Число π", String.raw`\pi=3.14`], ["Ускорение свободного падения", String.raw`g=10\,\mathrm{m/s^2}`],
  ["Гравитационная постоянная", String.raw`G=6.7\cdot10^{-11}\,\mathrm{N\,m^2/kg^2}`],
  ["Газовая постоянная", String.raw`R=8.31\,\mathrm{J/(mol\,K)}`],
  ["Постоянная Больцмана", String.raw`k_B=1.38\cdot10^{-23}\,\mathrm{J/K}`],
  ["Постоянная Авогадро", String.raw`N_A=6\cdot10^{23}\,\mathrm{mol^{-1}}`],
  ["Скорость света", String.raw`c=3\cdot10^8\,\mathrm{m/s}`],
  ["Коэффициент Кулона", String.raw`k=9\cdot10^9\,\mathrm{N\,m^2/C^2}`],
  ["Электрическая постоянная", String.raw`\varepsilon_0=8.85\cdot10^{-12}\,\mathrm{F/m}`],
  ["Элементарный заряд", String.raw`e=1.6\cdot10^{-19}\,\mathrm C`],
  ["Постоянная Планка", String.raw`h=6.6\cdot10^{-34}\,\mathrm{J\,s}`],
] as const;

export function baseLatex(expression: string) {
  return expression.split("/").map((part, index) => part.split("*").map(token => {
    if (token === "1") return "";
    const [unit, power] = token.split("^");
    const exponent = (power ? Number(power) : 1) * (index ? -1 : 1);
    return `\\mathrm{${unit}}${exponent === 1 ? "" : `^{${exponent}}`}`;
  }).join("\\," )).filter(Boolean).join("\\,") || "1";
}

export function dimensionLatex(dimension: number[]) {
  return dimension.map((power, index) => power ? `${["M", "L", "T", "I", "\\Theta", "N", "J"][index]}${power === 1 ? "" : `^{${power}}`}` : "").filter(Boolean).join("\\,") || "1";
}
