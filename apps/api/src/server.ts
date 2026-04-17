import { createApp } from "./app";
import { env } from "./config/env";

async function bootstrap() {
  const app = await createApp();
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
