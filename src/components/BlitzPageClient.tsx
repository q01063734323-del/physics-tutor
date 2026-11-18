"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import BlitzTrainer from "./BlitzTrainer";

export default function BlitzPageClient() {
  const [account, setAccount] = useState("guest");
  const demo = useSearchParams().get("demo") === "1";
  useEffect(() => onAuthStateChanged(auth, user => setAccount(user?.uid || "guest")), []);
  const identity = demo ? "demo-student" : account;
  return <main style={{ padding: "20px max(12px, env(safe-area-inset-left))", background: "#081426", minHeight: "100dvh" }}><nav style={{ maxWidth: 1440, margin: "0 auto 16px", padding: "0 18px" }} aria-label="Навигация блиц-тренажёра"><Link href="/" style={{ color: "#a8d8e4", fontSize: 13 }}>← Физика с Егором</Link></nav><BlitzTrainer key={identity} account={identity} demo={demo}/></main>;
}
