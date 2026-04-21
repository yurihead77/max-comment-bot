import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    platformUser?: {
      userId: string;
      maxUserId: string;
      isModerator: boolean;
    };
  }
}

function getHeader(request: FastifyRequest, key: string): string | undefined {
  const value = request.headers[key];
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export const platformUserPlugin = fp(async (app) => {
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const rawUserId = getHeader(request, "x-user-id")?.trim();
    const rawMaxUserId = getHeader(request, "x-max-user-id")?.trim();

    // Identity resolution strategy:
    // - x-user-id: prefer internal users.id, then fallback to users.max_user_id
    // - x-max-user-id: users.max_user_id
    let user = null;
    let resolvedBy: "x-user-id:id" | "x-user-id:maxUserId" | "x-max-user-id" | "none" = "none";

    if (rawUserId) {
      user = await app.prisma.user.findUnique({ where: { id: rawUserId } });
      if (user) {
        resolvedBy = "x-user-id:id";
      } else {
        user = await app.prisma.user.findUnique({ where: { maxUserId: rawUserId } });
        if (user) {
          resolvedBy = "x-user-id:maxUserId";
        }
      }
    }

    if (!user && rawMaxUserId) {
      user = await app.prisma.user.findUnique({ where: { maxUserId: rawMaxUserId } });
      if (user) {
        resolvedBy = "x-max-user-id";
      }
    }

    if (!user) {
      request.log.debug(
        {
          path: request.url,
          method: request.method,
          headers: {
            "x-user-id": rawUserId ?? null,
            "x-max-user-id": rawMaxUserId ?? null
          },
          userFound: false,
          moderatorFound: false,
          role: "anonymous_platform"
        },
        "platform-user: identity not resolved"
      );
      return;
    }

    const moderator = await app.prisma.moderator.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });

    request.platformUser = {
      userId: user.id,
      maxUserId: user.maxUserId,
      isModerator: Boolean(moderator)
    };

    request.log.debug(
      {
        path: request.url,
        method: request.method,
        resolvedBy,
        headers: {
          "x-user-id": rawUserId ?? null,
          "x-max-user-id": rawMaxUserId ?? null
        },
        userFound: true,
        userId: user.id,
        platformUserId: user.maxUserId,
        moderatorFound: Boolean(moderator),
        role: moderator ? "moderator" : "user"
      },
      "platform-user: identity resolved"
    );
  });
});
