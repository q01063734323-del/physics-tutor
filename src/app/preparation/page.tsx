import { Suspense } from "react";
import CommandCenter from "@/components/CommandCenter";
export const metadata = { title: "Моя подготовка · ЕГЭ COMMAND CENTER" };
export default function PreparationPage() { return <Suspense fallback={<main>Загружаем центр подготовки…</main>}><CommandCenter/></Suspense>; }
