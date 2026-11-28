import type { Metadata } from "next";
import PublishedTrainer from "@/components/PublishedTrainer";

export const metadata: Metadata = { title: "Тренажёр ЕГЭ по физике — Физика с Егором", description: "Авторские тренировочные задачи по физике с проверкой ответов и решениями." };

export default function TrainerPage() { return <PublishedTrainer />; }
