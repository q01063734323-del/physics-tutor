"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Enhances headings after hydration without hiding content or delaying routes. */
export function TypographyMotion() {
  const pathname = usePathname();
  useEffect(() => {
    // The private preview streams a large bank: leave its headings untouched
    // until React has hydrated the whole review interface.
    if (["/teacher/import-preview", "/trainer", "/blitz", "/classroom", "/preparation"].includes(pathname)) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const observed = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target.matches("h1 em")) {
          (entry.target as HTMLElement).style.animationPlayState = entry.isIntersecting && !document.hidden ? "running" : "paused";
        } else if (entry.isIntersecting) {
          entry.target.setAttribute("data-type-entered", "true");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: .15 });
    function scan() {
      for (const element of observed) {
        if (element.isConnected) continue;
        observer.unobserve(element);
        observed.delete(element);
      }
      if (media.matches) return;
      document.querySelectorAll("h1 em, main h2, .pt-dashboard h2").forEach(element => {
        if (observed.has(element) || element.closest(".katex, [data-reveal], [data-motion-scene]")) return;
        observed.add(element);
        observer.observe(element);
      });
    }
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    const pause = () => { document.querySelectorAll<HTMLElement>("h1 em").forEach(el => { el.style.animationPlayState = "paused"; observer.unobserve(el); observer.observe(el); }); };
    document.addEventListener("visibilitychange", pause);
    return () => { observer.disconnect(); mutations.disconnect(); document.removeEventListener("visibilitychange", pause); observed.forEach(el => el.removeAttribute("data-type-entered")); };
  }, [pathname]);
  return null;
}
