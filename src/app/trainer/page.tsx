import type { Metadata } from "next";
import PublishedTrainer from "@/components/PublishedTrainer";

export const metadata: Metadata = { title: "Тренажёр ЕГЭ по физике — Физика с Егором", description: "1460 заданий ЕГЭ: поиск по темам и номерам, исходные рисунки и проверка ответов." };

export default function TrainerPage() { return <PublishedTrainer />; }
