import "./process-exception-handlers";
import { runDbPreflight } from "./db/preflight";
import { createApp } from "./app";
import { env } from "./config/env";

async function bootstrap() {
  const skipPreflight = env.SKIP_DB_PREFLIGHT || env.DB_PREFLIGHT_MODE === "off";
  if (!skipPreflight) {
    await runDbPreflight({
      databaseUrl: env.DATABASE_URL,
      adminUrlOverride: env.DATABASE_PREFLIGHT_ADMIN_URL,
      mode: env.DB_PREFLIGHT_MODE,
      log: (line) => {
        console.error(line);
      }
    });
  }
  const app = await createApp();
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
