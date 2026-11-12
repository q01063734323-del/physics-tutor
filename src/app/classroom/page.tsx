import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassroomEntry } from "@/components/ClassroomEntry";
import { ClassroomWorkspace } from "@/components/ClassroomWorkspace";

export const metadata: Metadata = { title: "Виртуальный класс · Physics Tutor" };

export default function ClassroomPage() {
  return <Suspense fallback={<ClassroomWorkspace />}><ClassroomEntry /></Suspense>;
}
