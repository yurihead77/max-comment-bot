import type { FastifyPluginAsync } from "fastify";
import { ensureRole } from "../admin-authz";

export const adminModerationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureRole(request, reply, ["admin", "moderator"])) {
      return;
    }
  });

  app.get("/api/admin/moderation-actions", async (request) => {
    const query = request.query as { actionType?: string; page?: string; pageSize?: string };
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 200);

    const where = {
      ...(query.actionType ? { actionType: query.actionType } : {})
    };

    const [total, items] = await Promise.all([
      app.prisma.moderationAction.count({ where }),
      app.prisma.moderationAction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1)
      }
    };
  });
};
