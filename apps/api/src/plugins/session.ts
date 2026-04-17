import crypto from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

const COOKIE_NAME = "admin_session";

declare module "fastify" {
  interface FastifyRequest {
    adminSession?: {
      adminUserId: string;
      role: "admin" | "moderator";
    };
  }

  interface FastifyInstance {
    createAdminSession: (reply: FastifyReply, adminUserId: string) => Promise<void>;
    clearAdminSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function adminCookieBase() {
  const sameSite = env.ADMIN_COOKIE_SAME_SITE ?? (env.NODE_ENV === "production" ? "strict" : "lax");
  const secure = env.NODE_ENV === "production";
  return { path: "/" as const, httpOnly: true as const, sameSite, secure };
}

export const sessionPlugin = fp(async (app) => {
  app.decorate("createAdminSession", async (reply: FastifyReply, adminUserId: string) => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_SECONDS * 1000);

    await app.prisma.adminSession.create({
      data: { adminUserId, tokenHash, expiresAt }
    });

    const base = adminCookieBase();
    reply.setCookie(COOKIE_NAME, rawToken, {
      ...base,
      maxAge: env.ADMIN_SESSION_TTL_SECONDS,
      expires: expiresAt
    });
  });

  app.decorate("clearAdminSession", async (request: FastifyRequest, reply: FastifyReply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await app.prisma.adminSession.deleteMany({ where: { tokenHash } });
    }
    reply.clearCookie(COOKIE_NAME, adminCookieBase());
  });

  app.addHook("preHandler", async (request: FastifyRequest) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      return;
    }

    const tokenHash = hashToken(rawToken);
    const session = await app.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { adminUser: true }
    });

    if (!session || session.expiresAt < new Date() || !session.adminUser.isActive) {
      return;
    }

    request.adminSession = {
      adminUserId: session.adminUserId,
      role: session.adminUser.role
    };
  });
});
