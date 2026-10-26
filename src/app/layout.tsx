import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Физика с Егором — кабинет ученика",
  description: "Домашние задания, теория и тренажёр ЕГЭ по физике",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
