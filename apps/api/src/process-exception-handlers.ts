/**
 * Last-resort logging for PM2 / stderr when something escapes Fastify's error handling.
 * Register by importing this module once at process startup (see server.ts).
 */
function logToStderr(lines: string[]): void {
  for (const line of lines) {
    process.stderr.write(`${line}\n`);
  }
}

process.on("uncaughtException", (err) => {
  logToStderr([
    "[uncaughtException]",
    err?.name ?? "Error",
    err?.message ?? String(err),
    err?.stack ?? "(no stack)"
  ]);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logToStderr(["[unhandledRejection]", err.message, err.stack ?? "(no stack)"]);
});
