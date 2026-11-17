"use client";
export default function AdminError({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) {
  return (
    <div className="stack" style={{ maxWidth: 560, paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Something went wrong</h1>
      <p>The action didn&apos;t complete. Nothing was changed unless you see it on the page after reloading.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
      <button className="btn btn-dark btn-sm" style={{ alignSelf: "flex-start" }} onClick={reset}>Try again</button>
    </div>
  );
}
