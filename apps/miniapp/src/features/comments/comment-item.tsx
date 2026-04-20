import { useCallback, useRef } from "react";

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
  author?: CommentAuthorModel | null;
}

function displayName(author: CommentAuthorModel | null | undefined): string {
  if (!author) return "Пользователь";
  const parts = [author.firstName, author.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  if (author.username) return author.username.startsWith("@") ? author.username : `@${author.username}`;
  return "Пользователь";
}

function displayPublicId(author: CommentAuthorModel | null | undefined, fallbackAuthorId: string): string {
  if (author?.maxUserId) return `#${author.maxUserId}`;
  if (fallbackAuthorId.length <= 10) return `#${fallbackAuthorId}`;
  return `#${fallbackAuthorId.slice(0, 8)}…`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const w = parts[0] ?? "?";
  return w.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😡", "👎", "🔥"];

export interface CommentItemProps {
  comment: CommentItemModel;
  currentUserId: string;
  showAvatar: boolean;
  groupedWithPrevious: boolean;
  onOpenMenu: (comment: CommentItemModel, anchor: { x: number; y: number }) => void;
  reactionCounts: Record<string, number>;
  userReaction: string | undefined;
  onToggleReaction: (emoji: string) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  showAvatar,
  groupedWithPrevious,
  onOpenMenu,
  reactionCounts,
  userReaction,
  onToggleReaction
}: CommentItemProps) {
  const own = comment.authorId === currentUserId;
  const name = displayName(comment.author);
  const publicId = displayPublicId(comment.author, comment.authorId);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== undefined) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  }, []);

  const openAt = (clientX: number, clientY: number) => {
    onOpenMenu(comment, { x: clientX, y: clientY });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openAt(e.clientX, e.clientY);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".chat-bubble__menu-hit")) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = undefined;
      openAt(e.clientX, e.clientY);
    }, 480);
  };

  const rowClass =
    "chat-row" +
    (own ? " chat-row--own" : "") +
    (groupedWithPrevious ? " chat-row--grouped" : "");

  return (
    <li
      className={rowClass}
      data-comment-id={comment.id}
      data-author-id={comment.authorId}
      data-user-id={comment.authorId}
    >
      <div className="chat-bubble-wrap">
        <div className="chat-avatar-slot" aria-hidden={!showAvatar}>
          {showAvatar ? (
            <div className="chat-avatar">
              {comment.author?.photoUrl ? (
                <img src={comment.author.photoUrl} alt="" width={36} height={36} />
              ) : (
                initials(name)
              )}
            </div>
          ) : null}
        </div>
        <div
          className={"chat-bubble " + (own ? "chat-bubble--own" : "chat-bubble--other")}
          onContextMenu={onContextMenu}
          onPointerDown={onPointerDown}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
        >
          <button
            type="button"
            className="chat-bubble__menu-hit"
            aria-label="Меню сообщения"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              openAt(r.left + r.width / 2, r.bottom);
            }}
          >
            ⋯
          </button>
          <div className="chat-bubble__meta">
            <span className="chat-bubble__name">{name}</span>
            <span className="chat-bubble__id">{publicId}</span>
          </div>
          <p className="chat-bubble__text">{comment.text}</p>
          <div className="chat-bubble__footer">
            <span>
              {formatTime(comment.createdAt)}
              {comment.isEdited ? " · изменено" : ""}
            </span>
          </div>
        </div>
      </div>
      <div
        className="chat-reactions"
        aria-label="Реакции"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map((emoji) => {
          const count = reactionCounts[emoji] ?? 0;
          const active = userReaction === emoji;
          return (
            <button
              key={emoji}
              type="button"
              className={"chat-reaction-pill" + (active ? " chat-reaction-pill--active" : "")}
              onClick={() => onToggleReaction(emoji)}
            >
              {emoji}
              {count > 0 ? <span style={{ marginLeft: 4, opacity: 0.85 }}>{count}</span> : null}
            </button>
          );
        })}
      </div>
    </li>
  );
}
