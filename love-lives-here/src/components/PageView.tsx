"use client";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";
import { attribution, track } from "./track";

/** Page views + real-user Core Web Vitals (LCP, INP, CLS) for the dashboard's p75 figures. */
export function PageView() {
  const path = usePathname();
  useEffect(() => { attribution(); track("page_view"); }, [path]);
  useReportWebVitals((m) => {
    if (m.name !== "LCP" && m.name !== "INP" && m.name !== "CLS") return;
    // CLS is unitless; store x1000 to keep integers
    track("web_vital", { product: m.name, value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value) });
  });
  return null;
}
