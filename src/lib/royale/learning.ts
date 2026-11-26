import { balance, cards, type CardId } from './config';
import type { VerifiedAnswer, TopicProgress } from './progress';

export type LearningRecap = { energy: number; attempts: number; correct: number; topics: Record<string, TopicProgress>; missedIds: string[] };

export function learningRecap(answers: VerifiedAnswer[], energy: number, played: Partial<Record<CardId, number>>): LearningRecap {
 const topics = new Map<string, TopicProgress>();
 const missed = new Map<string, boolean>();
 for (const answer of answers) {
  for (const topic of new Set(answer.topics.length ? answer.topics : [answer.section])) {
   const item = topics.get(topic) ?? { attempts: 0, correct: 0 };
   item.attempts++;
   item.correct += Number(answer.correct);
   topics.set(topic, item);
  }
  if (answer.questionId) missed.set(answer.questionId, !answer.correct);
 }
 // The only sources are starting energy and accepted answers. Deployment is the only sink.
 const spent = Object.entries(played).reduce((sum, [id, amount]) => sum + cards[id as CardId].cost * amount, 0);
 return { energy: Math.max(0, energy + spent - balance.startEnergy), attempts: answers.length,
  correct: answers.filter(answer => answer.correct).length, topics: Object.fromEntries(topics),
  missedIds: [...missed].filter(([, wrong]) => wrong).map(([id]) => id) };
}

export function accuracy(attempts: number, correct: number) {
 return attempts ? Math.round(correct / attempts * 100) : null;
}

export function topicRows(stats: Record<string, TopicProgress>, catalogTopics: readonly string[]) {
 return catalogTopics.flatMap(topic => {
  const item = stats[topic];
  return item?.attempts > 0 ? [{ topic, ...item, percent: accuracy(item.attempts, item.correct)! }] : [];
 });
}
