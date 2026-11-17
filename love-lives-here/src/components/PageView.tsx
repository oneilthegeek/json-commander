"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { attribution, track } from "./track";

export function PageView() {
  const path = usePathname();
  useEffect(() => { attribution(); track("page_view"); }, [path]);
  return null;
}
