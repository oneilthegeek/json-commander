/** Next.js hook: report unhandled server errors (no request bodies or personal data). */
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { alert } = await import("./lib/alert");
  await alert("server_error", `${request.method} ${request.path.split("?")[0]}: ${(err as Error)?.message ?? String(err)}`.slice(0, 400));
}
