import type { PrismaClient } from "@prisma/client";

const SETTINGS_ID = "default";

export async function getAppSettings(prisma: PrismaClient) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {}
  });
}

export async function updateModerationChatMaxId(prisma: PrismaClient, moderationChatMaxId: string | null) {
  const normalized = moderationChatMaxId?.trim() || null;
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, moderationChatMaxId: normalized },
    update: { moderationChatMaxId: normalized }
  });
}
