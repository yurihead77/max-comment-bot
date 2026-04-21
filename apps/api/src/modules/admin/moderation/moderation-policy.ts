import type { FastifyReply, FastifyRequest } from "fastify";

type PolicyResult = { ok: true } | { ok: false };

export async function getModerationTargetInfo(request: FastifyRequest, targetUserId: string) {
  const actor = request.platformUser;
  const targetModerator = await request.server.prisma.moderator.findUnique({
    where: { userId: targetUserId },
    select: { id: true }
  });
  return {
    isSelf: Boolean(actor && actor.userId === targetUserId),
    isTargetModerator: Boolean(targetModerator)
  };
}

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

  const targetInfo = await getModerationTargetInfo(request, targetUserId);

  if (targetInfo.isSelf) {
    reply.code(403).send({ error: "cannot moderate self" });
    return { ok: false };
  }

  if (targetInfo.isTargetModerator) {
    reply.code(403).send({ error: "cannot moderate another moderator" });
    return { ok: false };
  }

  return { ok: true };
}
