import { useCallback, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ReactionBar, type ReactionState } from "./reaction-bar";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 12;

export interface CommentAuthorModel {
  id: string;
  maxUserId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
}

export interface CommentItemModel {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  isEdited: boolean;
  kind?: "comment" | "thread_header";
  systemAuthorName?: string | null;
  replyToCommentId?: string | null;
  replyPreview?: {
    id: string;
    authorName: string;
    textSnippet: string;
    isDeleted: boolean;
    isSystem: boolean;
  } | null;
  author?: CommentAuthorModel | null;
}

function authorDisplayName(author: CommentAuthorModel | null | undefined): string | null {
  if (!author) return null;
  const parts = [author.firstName, author.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  if (author.username) return author.username.startsWith("@") ? author.username : `@${author.username}`;
  return null;
}

function resolveDisplayName(
  comment: CommentItemModel,
  currentUserId: string,
  selfDisplayHint: string | null | undefined
): string {
  const fromApi = authorDisplayName(comment.author);
  if (fromApi) return fromApi;
  if (comment.authorId === currentUserId && selfDisplayHint?.trim()) return selfDisplayHint.trim();
  return "Пользователь";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const w = parts[0] ?? "?";
  return w.slice(0, 2).toUpperCase();
}

export interface CommentItemProps {
  comment: CommentItemModel;
  currentUserId: string;
  selfDisplayHint?: string | null;
  showAvatar: boolean;
  groupedWithPrevious: boolean;
  reportHighlight?: boolean;
  reportBadge?: { openCount: number; linkedReportClosed: boolean };
  onOpenMenu: (comment: CommentItemModel, anchor: { x: number; y: number }) => void;
  reactionState?: ReactionState;
  onToggleReaction: (emoji: string) => void;
  onJumpToComment?: (commentId: string) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  selfDisplayHint,
  showAvatar,
  groupedWithPrevious,
  reportHighlight,
  reportBadge,
  onOpenMenu,
  reactionState,
  onToggleReaction,
  onJumpToComment
}: CommentItemProps) {
  const kind = comment.kind ?? "comment";
  const isThreadHeader = kind === "thread_header";
  const own = comment.authorId === currentUserId;
  const name = isThreadHeader
    ? comment.systemAuthorName?.trim() || "Канал"
    : resolveDisplayName(comment, currentUserId, selfDisplayHint);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressListeners = useRef<{
    move: (e: PointerEvent) => void;
    end: () => void;
  } | null>(null);
  const longPressAnchor = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== undefined) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
    const l = longPressListeners.current;
    if (l) {
      window.removeEventListener("pointermove", l.move);
      window.removeEventListener("pointerup", l.end);
      window.removeEventListener("pointercancel", l.end);
      longPressListeners.current = null;
    }
    longPressAnchor.current = null;
  }, []);

  const openAt = (clientX: number, clientY: number) => {
    onOpenMenu(comment, { x: clientX, y: clientY });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (isThreadHeader) return;
    e.preventDefault();
    openAt(e.clientX, e.clientY);
  };

  const onBubbleClick = (e: React.MouseEvent) => {
    if (isThreadHeader) return;
    if ((e.target as HTMLElement).closest(".chat-bubble__menu-hit")) return;
    const sel = typeof window !== "undefined" ? window.getSelection?.()?.toString() ?? "" : "";
    if (sel.length > 0) return;
    openAt(e.clientX, e.clientY);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isThreadHeader) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".chat-bubble__menu-hit")) return;
    clearLongPress();

    const start = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    longPressAnchor.current = start;

    const onMove = (ev: PointerEvent) => {
      if (longPressAnchor.current?.pointerId !== ev.pointerId) return;
      const ax = longPressAnchor.current.x;
      const ay = longPressAnchor.current.y;
      const dx = ev.clientX - ax;
      const dy = ev.clientY - ay;
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clearLongPress();
      }
    };

    const onEnd = () => {
      clearLongPress();
    };

    longPressListeners.current = { move: onMove, end: onEnd };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);

    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = undefined;
      const l = longPressListeners.current;
      if (l) {
        window.removeEventListener("pointermove", l.move);
        window.removeEventListener("pointerup", l.end);
        window.removeEventListener("pointercancel", l.end);
        longPressListeners.current = null;
      }
      if (longPressAnchor.current?.pointerId === start.pointerId) {
        openAt(start.x, start.y);
      }
      longPressAnchor.current = null;
    }, LONG_PRESS_MS);
  };

  const onTouchMove = () => {
    clearLongPress();
  };

  const rowClass =
    "chat-row" +
    (isThreadHeader ? " chat-row--thread-header" : "") +
    (own ? " chat-row--own" : "") +
    (groupedWithPrevious ? " chat-row--grouped" : "") +
    (reportHighlight ? " chat-row--report-target" : "");

  return (
    <div
      className={rowClass}
      id={`comment-${comment.id}`}
      data-comment-id={comment.id}
      data-author-id={comment.authorId}
      data-user-id={comment.authorId}
      role="listitem"
    >
      <div className="chat-bubble-wrap">
        <div className="chat-avatar-slot" aria-hidden={!showAvatar}>
          {showAvatar && !isThreadHeader ? (
            <div className="chat-avatar">
              {comment.author?.photoUrl ? (
                <img src={comment.author.photoUrl} alt="" width={36} height={36} />
              ) : (
                initials(name)
              )}
            </div>
          ) : null}
        </div>
        <div className="chat-message-stack">
          {comment.replyPreview ? (
            <button
              type="button"
              className="comment-reply-quote"
              onClick={() => onJumpToComment?.(comment.replyPreview!.id)}
              aria-label={`Перейти к комментарию ${comment.replyPreview.authorName}`}
            >
              <span className="comment-reply-quote__author">{comment.replyPreview.authorName}</span>
              <span className="comment-reply-quote__text">{comment.replyPreview.textSnippet}</span>
            </button>
          ) : null}
          {reportBadge ? (
            <div className="chat-report-badge" aria-label="Жалоба">
              <span className="chat-report-badge__label">Жалоба</span>
              {reportBadge.openCount > 0 ? (
                <span className="chat-report-badge__count">{reportBadge.openCount}</span>
              ) : null}
              {reportBadge.linkedReportClosed ? (
                <span className="chat-report-badge__muted"> · обработана</span>
              ) : null}
            </div>
          ) : null}
          <MessageBubble
            own={isThreadHeader ? false : own}
            name={name}
            text={comment.text}
            createdAt={comment.createdAt}
            isEdited={comment.isEdited}
            showMenu={!isThreadHeader}
            onOpenMenuAt={openAt}
            onClick={onBubbleClick}
            onContextMenu={onContextMenu}
            onPointerDown={onPointerDown}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerLeave={clearLongPress}
            onTouchMove={onTouchMove}
          />
          {!isThreadHeader ? <ReactionBar state={reactionState} onToggleReaction={onToggleReaction} /> : null}
        </div>
      </div>
    </div>
  );
}
