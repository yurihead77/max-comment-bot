import path from "node:path";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { env } from "./config/env";
import { adminAuthRoutes } from "./modules/admin/auth/admin-auth.routes";
import { adminCommentsRoutes } from "./modules/admin/comments/admin-comments.routes";
import { adminModeratorsRoutes } from "./modules/admin/moderators/admin-moderators.routes";
import { adminModerationRoutes } from "./modules/admin/moderation/admin-moderation.routes";
import { adminRestrictionsRoutes } from "./modules/admin/restrictions/admin-restrictions.routes";
import { maxAuthRoutes } from "./modules/auth/max-auth.routes";
import { commentsRoutes } from "./modules/comments/comments.routes";
import { moderationReportsRoutes } from "./modules/moderation-reports/moderation-reports.routes";
import { adminSettingsRoutes } from "./modules/admin/settings/admin-settings.routes";
import { internalAppSettingsRoutes } from "./modules/internal/internal-app-settings.routes";
import { internalPostsRoutes } from "./modules/internal/internal-posts.routes";
import { meRoutes } from "./modules/me/me.routes";
import { postsRoutes } from "./modules/posts/posts.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { prismaPlugin } from "./plugins/prisma";
import { platformUserPlugin } from "./plugins/platform-user";
import { sessionPlugin } from "./plugins/session";

export async function createApp() {
  const app = Fastify({
    logger: true,
    trustProxy: env.TRUST_PROXY
  });

  await app.register(fastifyCors, { origin: true, credentials: true });
  await app.register(fastifyCookie, { secret: env.ADMIN_SESSION_SECRET });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: Math.floor(env.MAX_IMAGE_SIZE_MB * 1024 * 1024)
    },
    throwFileSizeLimit: true
  });
  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), env.UPLOAD_DIR),
    prefix: "/uploads/"
  });

  await app.register(prismaPlugin);

  app.get("/health/db", async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: "connected" };
    } catch (e) {
      request.log.error({ err: e }, "/health/db: Prisma query failed");
      return reply.code(503).send({
        ok: false,
        database: "unavailable",
        error: e instanceof Error ? e.message : String(e)
      });
    }
  });

  await app.register(sessionPlugin);
  await app.register(platformUserPlugin);

  await app.register(maxAuthRoutes);
  await app.register(meRoutes);
  await app.register(postsRoutes);
  await app.register(commentsRoutes);
  await app.register(moderationReportsRoutes);
  await app.register(uploadsRoutes);
  await app.register(internalAppSettingsRoutes);
  await app.register(internalPostsRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminCommentsRoutes);
  await app.register(adminModeratorsRoutes);
  await app.register(adminRestrictionsRoutes);
  await app.register(adminModerationRoutes);
  await app.register(adminSettingsRoutes);

  app.get("/healthz", async () => ({ ok: true }));

  return app;
}
