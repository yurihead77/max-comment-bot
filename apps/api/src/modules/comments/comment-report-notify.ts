import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { getModerationChatMaxId } from "../settings/moderation-chat";

function buildDiscussionUrl(postId: string, commentId: string): string | undefined {
  const base = env.MINIAPP_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) return undefined;
  const u = new URL(base);
  u.searchParams.set("postId", postId);
  u.searchParams.set("commentId", commentId);
  return u.toString();
}

function buildAdminUrl(): string | undefined {
  const base = env.ADMIN_PANEL_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/`;
}

export async function sendModerationChatReportNotification(
  app: FastifyInstance,
  args: {
    reportId: string;
    commentId: string;
    postId: string;
    channelTitle: string | null;
    channelMaxChatId: string;
    postMaxMessageId: string;
    authorDisplay: string;
    authorMaxUserId: string;
    commentPreview: string;
    openReportsCount: number;
  }
): Promise<void> {
  const moderationChatMaxId = await getModerationChatMaxId(app.prisma);
  if (!moderationChatMaxId) {
    return;
  }

  const discussUrl = buildDiscussionUrl(args.postId, args.commentId);
  const adminUrl = buildAdminUrl();
  const channelLine = args.channelTitle
    ? `Канал: ${args.channelTitle} (${args.channelMaxChatId})`
    : `Канал: ${args.channelMaxChatId}`;
  const lines = [
    "Жалоба на комментарий",
    channelLine,
    `Пост (MAX message id): ${args.postMaxMessageId}`,
    `Автор: ${args.authorDisplay} (MAX user id: ${args.authorMaxUserId})`,
    `Текст: ${args.commentPreview.slice(0, 500)}${args.commentPreview.length > 500 ? "…" : ""}`,
    `Открытых жалоб: ${args.openReportsCount}`,
    discussUrl ? `Открыть обсуждение: ${discussUrl}` : undefined,
    adminUrl ? `Admin: ${adminUrl}` : undefined
  ].filter(Boolean) as string[];

  const text = lines.join("\n");
  const botUrl = `${env.BOT_INTERNAL_BASE_URL.replace(/\/$/, "")}/internal/send-plain-message`;
  try {
    const res = await fetch(botUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: moderationChatMaxId,
        text,
        moderationCard: {
          reportId: args.reportId
        }
      })
    });
    if (!res.ok) {
      const bodyText = await res.text();
      app.log.error({ status: res.status, bodyPreview: bodyText.slice(0, 500) }, "moderation report notify: bot send failed");
    }
  } catch (e) {
    app.log.error({ err: e instanceof Error ? e.message : String(e) }, "moderation report notify: fetch threw");
  }
}
