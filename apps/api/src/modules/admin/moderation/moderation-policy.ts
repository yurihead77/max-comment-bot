import type { FastifyReply, FastifyRequest } from "fastify";

type PolicyResult = { ok: true } | { ok: false };

export async function ensureCanModerateTargetUser(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUserId: string
): Promise<PolicyResult> {
  if (request.adminSession) {
    return { ok: true };
  }

  const actor = request.platformUser;
  if (!actor?.isModerator) {
    reply.code(403).send({ error: "forbidden" });
    return { ok: false };
  }

  if (actor.userId === targetUserId) {
    reply.code(403).send({ error: "moderator cannot moderate self" });
    return { ok: false };
  }

  const [targetModerator, targetAdmin] = await Promise.all([
    request.server.prisma.moderator.findUnique({ where: { userId: targetUserId }, select: { id: true } }),
    request.server.prisma.adminUser.findUnique({ where: { id: targetUserId }, select: { id: true } })
  ]);

  if (targetModerator) {
    reply.code(403).send({ error: "moderator cannot moderate another moderator" });
    return { ok: false };
  }

  if (targetAdmin) {
    reply.code(403).send({ error: "moderator cannot moderate admin" });
    return { ok: false };
  }

  return { ok: true };
}
