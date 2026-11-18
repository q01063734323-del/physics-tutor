import "server-only";
import published from "../../data/trainer/physics-2026.json";
import { canPublishQuestion, type TrainerQuestion } from "./trainer-bank";
import { publicTrainerQuestion } from "./trainer-public";

export const publishedTrainerQuestions = (published.questions as TrainerQuestion[]).filter(canPublishQuestion);
export const publishedTrainerVersion = published.version;
export const publishedTrainerCatalog = publishedTrainerQuestions.map(publicTrainerQuestion);
export const publishedTrainerById = new Map(publishedTrainerQuestions.map(question => [question.id, question]));
