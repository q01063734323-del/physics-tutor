"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { onAuthStateChanged,type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MaterialsLibrary } from "./MaterialsLibrary";
import s from "./Library.module.css";
export function LibraryPage(){const [user,setUser]=useState<User|null>();useEffect(()=>onAuthStateChanged(auth,setUser),[]);const context=useMemo(()=>({user}),[user]);return <main className={s.page}><nav><Link href="/">← Физика с Егором</Link><Link href="/classroom">Physics Studio ↗</Link></nav>{user===undefined?<p role="status">Проверяем вход…</p>:user?<MaterialsLibrary key={user.uid} context={context}/>:<section className={s.empty}><p className={s.eyebrow}>PHYSICS LIBRARY</p><h1>Ваш курс, собранный в одном месте.</h1><p>Войдите в аккаунт, чтобы открыть приватную библиотеку.</p><Link href="/">Перейти ко входу →</Link></section>}</main>;}
