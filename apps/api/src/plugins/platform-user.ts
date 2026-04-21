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
    const rawUserId = getHeader(request, "x-user-id");
    const rawMaxUserId = getHeader(request, "x-max-user-id");

    const user = rawUserId
      ? await app.prisma.user.findUnique({ where: { id: rawUserId } })
      : rawMaxUserId
        ? await app.prisma.user.findUnique({ where: { maxUserId: rawMaxUserId } })
        : null;

    if (!user) {
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
  });
});
