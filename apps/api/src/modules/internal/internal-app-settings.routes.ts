import type { FastifyPluginAsync } from "fastify";
import { getModerationChatMaxId } from "../settings/moderation-chat";

export const internalAppSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/internal/app-settings", async () => {
    const moderationChatMaxId = await getModerationChatMaxId(app.prisma);
    return { moderationChatMaxId };
  });
};
