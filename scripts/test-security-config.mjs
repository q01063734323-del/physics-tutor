import { readFile } from "node:fs/promises";

const page = await readFile("src/app/page.tsx", "utf8");
const rules = await readFile("firestore.rules", "utf8");
const example = await readFile(".env.example", "utf8");

if (page.includes('DEMO_PASSWORD = "physics2025"') || page.includes('password === "physics2025"')) throw new Error("demo password is hardcoded in client code");
if (!page.includes("process.env.NEXT_PUBLIC_DEMO_PASSWORD")) throw new Error("demo password must come from environment configuration");
if (!page.includes('process.env.NEXT_PUBLIC_ENABLE_DEMO === "true"') || !page.includes('process.env.NODE_ENV !== "production"')) throw new Error("demo mode must be disabled in production");
if (page.includes('normalizedLogin === "egor"')) throw new Error("legacy local teacher bypass remains");
if (!rules.includes("match /users/{userId}")) throw new Error("user profile rules are missing");
if (!rules.includes("match /teacherStudents/{linkId}")) throw new Error("teacher student link rules are missing");
if (!example.includes("NEXT_PUBLIC_ENABLE_DEMO=false")) throw new Error("safe demo default is missing");
console.log("security configuration tests passed");
