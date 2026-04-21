import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ensureRole } from "../admin-authz";
import { getAppSettings, updateModerationChatMaxId } from "../../settings/app-settings.service";

const patchSchema = z.object({
  /** MAX platform chat id for moderator notifications; empty string clears. */
  moderationChatId: z.union([z.string().max(256), z.literal(""), z.null()]).optional()
});

export const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureRole(request, reply, ["admin"])) {
      return;
    }
  });

  app.get("/api/admin/settings", async () => {
    const row = await getAppSettings(app.prisma);
    return {
      moderationChatId: row.moderationChatMaxId ?? null
    };
  });

  app.patch("/api/admin/settings", async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    if (parsed.data.moderationChatId === undefined) {
      return reply.code(400).send({ error: "moderationChatId is required (use null or \"\" to clear)" });
    }
    const raw = parsed.data.moderationChatId;
    const next = raw === null || raw === "" ? null : raw.trim();
    const updated = await updateModerationChatMaxId(app.prisma, next);
    return { moderationChatId: updated.moderationChatMaxId ?? null };
  });
};
