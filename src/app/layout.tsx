import type { Metadata } from "next";
import "./globals.css";
import "./physics-design.css";

export const metadata: Metadata = {
  title: "Physics Tutor — физика с Егором",
  description: "Домашние задания, теория и тренажёр ЕГЭ по физике",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
