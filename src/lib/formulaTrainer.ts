export type FormulaAttempt = {
  attempts: number;
  solved: boolean;
  showHint: boolean;
  revealAnswer: boolean;
};

export function createFormulaAttempt(): FormulaAttempt {
  return { attempts: 0, solved: false, showHint: false, revealAnswer: false };
}

export function applyFormulaAnswer(state: FormulaAttempt, correct: boolean): FormulaAttempt {
  const attempts = state.attempts + 1;
  return { attempts, solved: correct, showHint: !correct && attempts >= 2, revealAnswer: !correct && attempts >= 3 };
}
