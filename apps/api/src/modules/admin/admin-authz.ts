import type { FastifyReply, FastifyRequest } from "fastify";

type AdminRole = "admin" | "moderator";

export function ensureAdminSession(request: FastifyRequest, reply: FastifyReply) {
  if (!request.adminSession) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

export function ensureRole(request: FastifyRequest, reply: FastifyReply, allowed: AdminRole[]) {
  if (!ensureAdminSession(request, reply)) {
    return false;
  }
  if (!allowed.includes(request.adminSession!.role)) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

export function ensureModeratorOrAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.adminSession) {
    return true;
  }
  if (request.platformUser?.isModerator) {
    return true;
  }
  reply.code(403).send({ error: "forbidden" });
  return false;
}

export function getActor(request: FastifyRequest): { actorId: string; actorType: "admin" | "platform_moderator" } {
  if (request.adminSession) {
    return { actorId: request.adminSession.adminUserId, actorType: "admin" };
  }
  if (request.platformUser?.isModerator) {
    return { actorId: request.platformUser.userId, actorType: "platform_moderator" };
  }
  throw new Error("actor not found");
}
