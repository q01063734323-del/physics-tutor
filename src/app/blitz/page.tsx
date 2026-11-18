import type { Metadata } from "next";
import { Suspense } from "react";
import BlitzPageClient from "@/components/BlitzPageClient";

export const metadata: Metadata = { title: "Блиц по формулам ЕГЭ-2027 — Физика с Егором", description: "Формулы, величины, СИ, повторение и десять режимов практики по реестру ФИПИ." };
export default function BlitzPage() { return <Suspense fallback={<main>Готовим тренировку…</main>}><BlitzPageClient/></Suspense>; }
