"use client";
import { useEffect } from "react";
import { track } from "./track";

export function ViewTracker({ product, event = "product_view" }: { product?: string; event?: string }) {
  useEffect(() => { track(event, { product }); }, [product, event]);
  return null;
}
