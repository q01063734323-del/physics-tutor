import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";
import "./physics-design.css";
import "./premium-app.css";

export const metadata: Metadata = {
  title: "Physics Tutor — физика с Егором",
  description: "Домашние задания, теория и тренажёр ЕГЭ по физике",
  manifest: "/manifest.webmanifest",
  applicationName: "Физика с Егором",
  appleWebApp: { capable: true, title: "Физика с Егором", statusBarStyle: "black-translucent" },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07142B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>{children}<Suspense fallback={null}><PwaRegistration /></Suspense></body>
    </html>
  );
}
