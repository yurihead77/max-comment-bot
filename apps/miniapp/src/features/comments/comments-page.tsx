import { useEffect, useMemo, useState } from "react";
import {
  authByDevMock,
  authByInitData,
  blockUserByModerator,
  createComment,
  deleteOwnComment,
  reportComment,
  getMeRole,
  getComments,
  getPost,
  getModerationReportContext,
  moderateCommentByModerator,
  muteUserByModerator,
  resolveModerationReportKeep,
  unblockUserByModerator,
  updateOwnComment,
  uploadCommentImage
} from "../../lib/api-client";
import type { ModerationReportContext } from "../../lib/api-client";
import { parseReportIdFromStartParam } from "../../lib/report-deeplink";
import { getInitDataUnsafeUser, getStartParam, waitForInitData } from "../../lib/max-webapp";
import { CommentList } from "./comment-list";
import type { CommentItemModel } from "./comment-item";
import { RestrictionBanner } from "../restrictions/restriction-banner";
import { COMMENT_NO_POST } from "./comment-ui-strings";
import { Composer } from "./composer";
import "./comments-chat.css";

function hintFromInitDataUnsafeUser(): string | null {
  const u = getInitDataUnsafeUser();
  if (!u) return null;
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (u.username) return u.username.startsWith("@") ? u.username : `@${u.username}`;
  return null;
}

export function CommentsPage() {
  const [userId, setUserId] = useState<string>("");
  const [postId, setPostId] = useState<string>("");
  const [comments, setComments] = useState<CommentItemModel[]>([]);
  const [restriction, setRestriction] = useState<null | { type: string; endsAt: string | null }>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<CommentItemModel | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<CommentItemModel | null>(null);
  const [selfDisplayHint, setSelfDisplayHint] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [role, setRole] = useState<"user" | "moderator">("user");
  const [reportDeepLink, setReportDeepLink] = useState<{
    reportId: string;
    context: ModerationReportContext;
  } | null>(null);

  function toBootstrapErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) return "Ошибка загрузки данных";
    const msg = error.message.toLowerCase();
    if (msg.includes("initdata or devmock is required")) {
      return "MAX не передал initData (попробуйте открыть mini app повторно)";
    }
    if (msg.includes("hash is missing")) {
      return "MAX передал неполный initData (нет hash). Попробуйте открыть mini app ещё раз";
    }
    if (msg.includes("auth failed") || msg.includes("dev auth failed")) {
      return "Не удалось авторизовать mini app";
    }
    return error.message || "Ошибка загрузки данных";
  }

  async function refreshReportContext(reportId: string, uid: string) {
    const ctx = await getModerationReportContext(reportId, uid);
    setReportDeepLink({ reportId, context: ctx });
  }

  async function reloadComments(currentPostId: string, includeHidden?: boolean) {
    const response = await getComments(currentPostId, includeHidden ? { includeHidden: true } : undefined);
    const toAuthor = (v: unknown): CommentItemModel["author"] => {
      if (!v || typeof v !== "object") return null;
      const a = v as Record<string, unknown>;
      return {
        id: String(a.id ?? ""),
        maxUserId: String(a.maxUserId ?? ""),
        username: typeof a.username === "string" ? a.username : null,
        firstName: typeof a.firstName === "string" ? a.firstName : null,
        lastName: typeof a.lastName === "string" ? a.lastName : null,
        photoUrl: typeof a.photoUrl === "string" ? a.photoUrl : null
      };
    };
    const mapped: CommentItemModel[] = response.items.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      text: c.text as string,
      authorId: c.authorId as string,
      createdAt: c.createdAt as string,
      isEdited: Boolean(c.isEdited),
      kind: ((c.kind as string | undefined) ?? "comment") as "comment" | "thread_header",
      systemAuthorName: (c.systemAuthorName as string | null | undefined) ?? null,
      replyToCommentId: (c.replyToCommentId as string | null | undefined) ?? null,
      replyPreview:
        c.replyPreview && typeof c.replyPreview === "object"
          ? {
              id: String((c.replyPreview as Record<string, unknown>).id ?? ""),
              authorName: String((c.replyPreview as Record<string, unknown>).authorName ?? "Пользователь"),
              textSnippet: String((c.replyPreview as Record<string, unknown>).textSnippet ?? ""),
              isDeleted: Boolean((c.replyPreview as Record<string, unknown>).isDeleted),
              isSystem: Boolean((c.replyPreview as Record<string, unknown>).isSystem)
            }
          : null,
      author: toAuthor(c.author)
    }));
    setComments(mapped);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const updateVh = () => {
      const vv = window.visualViewport;
      const h = vv?.height ?? window.innerHeight;
      root.style.setProperty("--app-vh", `${h}px`);
    };
    updateVh();
    window.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("scroll", updateVh);
    return () => {
      window.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("scroll", updateVh);
      root.style.removeProperty("--app-vh");
    };
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setBootstrapError(null);
      try {
        const startParam = getStartParam();
        const query = new URLSearchParams(window.location.search);
        const postFromQuery = query.get("postId") ?? import.meta.env.VITE_DEV_POST_ID ?? "";
        const reportIdFromDeepLink = parseReportIdFromStartParam(startParam);
        const resolvedPostId = reportIdFromDeepLink
          ? ""
          : (startParam?.replace(/^post_/, "") || postFromQuery || "").trim();

        const useDevMock = import.meta.env.VITE_DEV_MAX_AUTH === "true";
        let auth: Awaited<ReturnType<typeof authByInitData>>;
        if (useDevMock) {
          auth = await authByDevMock({
            maxUserId: String(import.meta.env.VITE_DEV_MAX_USER_ID ?? "900001"),
            username: "localdev",
            chatMaxId: String(import.meta.env.VITE_DEV_CHAT_MAX_ID ?? "-100"),
            startParam: startParam || (resolvedPostId ? `post_${resolvedPostId}` : undefined)
          });
          setSelfDisplayHint("localdev");
        } else {
          const initData = await waitForInitData();
          console.log("MAX initData diagnostics", {
            length: initData.length,
            hasHash: initData.includes("hash="),
            hasAuthDate: initData.includes("auth_date=")
          });
          auth = await authByInitData(initData);
          setSelfDisplayHint(hintFromInitDataUnsafeUser());
        }

        setUserId(auth.userId);
        setReportDeepLink(null);
        let resolvedRole: "user" | "moderator" = "user";
        try {
          const meRole = await getMeRole(auth.userId);
          resolvedRole = meRole.role;
          setRole(meRole.role);
        } catch {
          setRole("user");
        }

        if (reportIdFromDeepLink) {
          const ctx = await getModerationReportContext(reportIdFromDeepLink, auth.userId);
          setReportDeepLink({ reportId: reportIdFromDeepLink, context: ctx });
          setPostId(ctx.postId);
          const post = await getPost(ctx.postId, auth.userId);
          setRestriction(post.restriction);
          await reloadComments(ctx.postId, resolvedRole === "moderator");
        } else {
          const postIdFromAuth = auth.startParam?.replace(/^post_/, "").trim() ?? "";
          const finalPostId = resolvedPostId || postIdFromAuth;
          setPostId(finalPostId);

          if (finalPostId) {
            const post = await getPost(finalPostId, auth.userId);
            setRestriction(post.restriction);
            await reloadComments(finalPostId);
          }
        }
      } catch (error) {
        setBootstrapError(toBootstrapErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [bootstrapAttempt]);

  const canComment = useMemo(() => !restriction, [restriction]);

  if (loading) {
    return (
      <div className="comments-app" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "#9b9ba3" }}>Загрузка…</p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <main className="comments-app" style={{ padding: 16, justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.1rem" }}>Не удалось загрузить обсуждение</h1>
        <p style={{ color: "#9b9ba3" }}>{bootstrapError}</p>
        <button type="button" onClick={() => setBootstrapAttempt((n) => n + 1)}>
          Повторить
        </button>
      </main>
    );
  }

  async function handleResolveKeepFromReport() {
    if (!reportDeepLink) return;
    await resolveModerationReportKeep(reportDeepLink.reportId, userId);
    await refreshReportContext(reportDeepLink.reportId, userId);
    await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
  }

  const reportBanner = reportDeepLink
    ? {
        handled: reportDeepLink.context.reportStatus !== "open",
        deleted: reportDeepLink.context.commentStatus === "deleted",
        noRights: !reportDeepLink.context.canModerate
      }
    : null;

  return (
    <div className="comments-app">
      <header className="comments-app__header">
        <h1>Обсуждение</h1>
        {reportBanner ? (
          <div className="report-dl-banner" role="status">
            {reportBanner.handled ? <p className="report-dl-banner__line">Жалоба уже обработана.</p> : null}
            {reportBanner.deleted ? <p className="report-dl-banner__line">Комментарий удалён.</p> : null}
            {reportBanner.noRights ? (
              <p className="report-dl-banner__line">Недостаточно прав для модерации этого автора.</p>
            ) : null}
            {reportDeepLink &&
            reportDeepLink.context.canModerate &&
            reportDeepLink.context.reportsOpenCount > 0 ? (
              <button type="button" className="report-dl-banner__action" onClick={() => void handleResolveKeepFromReport()}>
                Закрыть жалобу без удаления
              </button>
            ) : null}
          </div>
        ) : null}
        <RestrictionBanner restriction={restriction} />
      </header>
      {postId ? (
        <CommentList
          comments={comments}
          currentUserId={userId}
          selfDisplayHint={selfDisplayHint}
          postId={postId}
          highlightCommentId={reportDeepLink?.context.commentId}
          reportBadge={
            reportDeepLink && reportDeepLink.context.commentStatus !== "deleted"
              ? {
                  commentId: reportDeepLink.context.commentId,
                  openCount: reportDeepLink.context.reportsOpenCount,
                  linkedReportClosed: reportDeepLink.context.reportStatus !== "open"
                }
              : undefined
          }
          reportModMenu={
            reportDeepLink &&
            reportDeepLink.context.canModerate &&
            reportDeepLink.context.reportsOpenCount > 0
              ? { anchorCommentId: reportDeepLink.context.commentId, onResolveKeep: handleResolveKeepFromReport }
              : undefined
          }
          onReply={(c) => {
            setReplyToMessage(c);
            setEditingMessage(null);
          }}
          onEdit={(c) => {
            setEditingMessage(c);
            setReplyToMessage(null);
          }}
          onDelete={async (commentId) => {
            await deleteOwnComment(commentId, userId);
            await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
          }}
          canModerate={role === "moderator"}
          onModerateDelete={async (commentId) => {
            if (!window.confirm("Delete comment as moderator?")) return;
            await moderateCommentByModerator(userId, commentId, "delete");
            if (reportDeepLink) {
              await refreshReportContext(reportDeepLink.reportId, userId);
            }
            await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
          }}
          onMuteUser={async (targetUserId) => {
            if (!window.confirm("Mute this user?")) return;
            await muteUserByModerator(userId, targetUserId);
          }}
          onBlockUser={async (targetUserId) => {
            if (!window.confirm("Block this user?")) return;
            await blockUserByModerator(userId, targetUserId);
          }}
          onUnblockUser={async (targetUserId) => {
            if (!window.confirm("Unblock this user?")) return;
            await unblockUserByModerator(userId, targetUserId);
          }}
          onReport={async (c) => {
            const reason = window.prompt("Причина жалобы (необязательно)") ?? "";
            try {
              await reportComment(c.id, userId, reason.trim() || undefined);
            } catch {
              window.alert("Не удалось отправить жалобу");
            }
          }}
        />
      ) : (
        <div className="comments-app__scroll">
          <div className="chat-empty">
            <p className="chat-empty__title">{COMMENT_NO_POST}</p>
            <p className="chat-empty__subtitle">Откройте обсуждение из поста в MAX.</p>
          </div>
        </div>
      )}
      {canComment && postId && (
        <Composer
          editingMessage={editingMessage}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
          onSubmit={async (text, files) => {
            const attachmentIds: string[] = [];
            for (const file of files) {
              const uploaded = await uploadCommentImage(file);
              attachmentIds.push(uploaded.id);
            }

            if (editingMessage) {
              await updateOwnComment(editingMessage.id, userId, text);
              setEditingMessage(null);
            } else {
              await createComment(postId, userId, text, attachmentIds, replyToMessage?.id ?? undefined);
              setReplyToMessage(null);
            }
            await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
          }}
        />
      )}
    </div>
  );
}
