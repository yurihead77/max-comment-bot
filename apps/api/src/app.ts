import path from "node:path";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { env } from "./config/env";
import { adminAuthRoutes } from "./modules/admin/auth/admin-auth.routes";
import { adminCommentsRoutes } from "./modules/admin/comments/admin-comments.routes";
import { adminModerationRoutes } from "./modules/admin/moderation/admin-moderation.routes";
import { adminRestrictionsRoutes } from "./modules/admin/restrictions/admin-restrictions.routes";
import { maxAuthRoutes } from "./modules/auth/max-auth.routes";
import { commentsRoutes } from "./modules/comments/comments.routes";
import { internalPostsRoutes } from "./modules/internal/internal-posts.routes";
import { postsRoutes } from "./modules/posts/posts.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { prismaPlugin } from "./plugins/prisma";
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
  await app.register(sessionPlugin);

  await app.register(maxAuthRoutes);
  await app.register(postsRoutes);
  await app.register(commentsRoutes);
  await app.register(uploadsRoutes);
  await app.register(internalPostsRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminCommentsRoutes);
  await app.register(adminRestrictionsRoutes);
  await app.register(adminModerationRoutes);

  app.get("/healthz", async () => ({ ok: true }));

  return app;
}
