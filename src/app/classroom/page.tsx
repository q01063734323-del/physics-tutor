import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassroomEntry } from "@/components/ClassroomEntry";
import { ClassroomWorkspace } from "@/components/ClassroomWorkspace";

export const metadata: Metadata = { title: "PHYSICS STUDIO · Физика с Егором" };

export default function ClassroomPage() {
  return <Suspense fallback={<ClassroomWorkspace />}><ClassroomEntry /></Suspense>;
}
