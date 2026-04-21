import type { PrismaClient } from "@prisma/client";

const SETTINGS_ID = "default";

export async function getModerationChatMaxId(prisma: PrismaClient): Promise<string | null> {
  const row = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { moderationChatMaxId: true }
  });
  const v = row?.moderationChatMaxId?.trim();
  return v && v.length > 0 ? v : null;
}

/** `maxChatId` is MAX platform chat id (same string as `chats.max_chat_id` / webhook `chatId`). */
export async function isModerationChat(prisma: PrismaClient, maxChatId: string): Promise<boolean> {
  const mod = await getModerationChatMaxId(prisma);
  if (!mod) return false;
  return mod === maxChatId.trim();
}
