"use client";
/** Last-resort error page if the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#FDF9F6", color: "#2A0C13" }}>
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: 16 }}>
          <h1>Sorry — something went wrong.</h1>
          <p>Please try again. If it keeps happening, message us on WhatsApp: <a href="https://wa.me/2348107134258">0810 713 4258</a>.</p>
          <button onClick={reset} style={{ padding: "12px 20px", background: "#4A1220", color: "#FFF4EE", border: 0 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
