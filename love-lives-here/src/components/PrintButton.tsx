"use client";
export function PrintButton() {
  return <button type="button" className="link-btn no-print" onClick={() => window.print()}>Print</button>;
}
