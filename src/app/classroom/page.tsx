import type { Metadata } from "next";
import { ClassroomWorkspace } from "@/components/ClassroomWorkspace";

export const metadata: Metadata = { title: "Виртуальный класс · Physics Tutor" };

export default function ClassroomPage() {
  return <ClassroomWorkspace />;
}
