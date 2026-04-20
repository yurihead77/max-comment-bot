import { useEffect, useMemo, useState } from "react";
import {
  authByDevMock,
  authByInitData,
  createComment,
  deleteOwnComment,
  getComments,
  getPost,
  updateOwnComment,
  uploadCommentImage
} from "../../lib/api-client";
import { getInitDataUnsafeUser, getStartParam, waitForInitData } from "../../lib/max-webapp";
import { CommentInput } from "./comment-input";
import { CommentList } from "./comment-list";
import { ReplyPreview } from "./reply-preview";
import type { CommentItemModel } from "./comment-item";
import { RestrictionBanner } from "../restrictions/restriction-banner";
import { COMMENT_NO_POST } from "./comment-ui-strings";
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

  async function reloadComments(currentPostId: string) {
    const response = await getComments(currentPostId);
    const mapped: CommentItemModel[] = response.items.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      text: c.text as string,
      authorId: c.authorId as string,
      createdAt: c.createdAt as string,
      isEdited: Boolean(c.isEdited),
      author: (c.author as CommentItemModel["author"]) ?? null
    }));
    setComments(mapped);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setBootstrapError(null);
      try {
        const startParam = getStartParam();
        const query = new URLSearchParams(window.location.search);
        const postFromQuery = query.get("postId") ?? import.meta.env.VITE_DEV_POST_ID ?? "";
        const resolvedPostId = (startParam?.replace(/^post_/, "") || postFromQuery || "").trim();

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
        const postIdFromAuth = auth.startParam?.replace(/^post_/, "").trim() ?? "";
        const finalPostId = resolvedPostId || postIdFromAuth;
        setPostId(finalPostId);

        if (finalPostId) {
          const post = await getPost(finalPostId, auth.userId);
          setRestriction(post.restriction);
          await reloadComments(finalPostId);
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

  return (
    <div className="comments-app">
      <header className="comments-app__header">
        <h1>Обсуждение</h1>
        <RestrictionBanner restriction={restriction} />
      </header>
      {postId ? (
        <CommentList
          comments={comments}
          currentUserId={userId}
          selfDisplayHint={selfDisplayHint}
          postId={postId}
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
            await reloadComments(postId);
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
        <div className="comments-app__composer">
          {!editingMessage ? (
            <ReplyPreview replyTo={replyToMessage} onCancel={() => setReplyToMessage(null)} />
          ) : null}
          <CommentInput
            submitLabel={editingMessage ? "Сохранить" : "Отправить"}
            initialText={editingMessage?.text ?? ""}
            replyTo={editingMessage ? null : replyToMessage}
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
                await createComment(postId, userId, text, attachmentIds);
                setReplyToMessage(null);
              }
              await reloadComments(postId);
            }}
          />
        </div>
      )}
    </div>
  );
}
