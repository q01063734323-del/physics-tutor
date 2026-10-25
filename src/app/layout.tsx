import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Физика с Егором — кабинет ученика",
  description: "Домашние задания и прогресс ученика по физике",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
