import { useEffect, useMemo, type CSSProperties } from "react";
import type { CommentItemModel } from "./comment-item";
import { CONTEXT_MENU_REACTION_EMOJIS } from "./comment-reactions";
import {
  COMMENT_CTX_COPY_LINK,
  COMMENT_CTX_COPY_TEXT,
  COMMENT_CTX_DELETE,
  COMMENT_CTX_EDIT,
  COMMENT_CTX_REPLY,
  COMMENT_CTX_REPORT
} from "./comment-ui-strings";

const POPOVER_W = 268;

function popoverPosition(anchor: { x: number; y: number }): CSSProperties {
  const margin = 10;
  const estH = 340;
  let left = anchor.x - POPOVER_W / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - POPOVER_W - margin));
  let top = anchor.y - estH - margin;
  if (top < margin) top = anchor.y + margin;
  top = Math.max(margin, Math.min(top, window.innerHeight - estH - margin));
  return {
    position: "fixed",
    left,
    top,
    width: POPOVER_W,
    maxWidth: `min(${POPOVER_W}px, calc(100vw - ${margin * 2}px))`,
    zIndex: 1001,
    transform: "none"
  };
}

export interface CommentContextMenuProps {
  comment: CommentItemModel | null;
  anchor: { x: number; y: number } | null;
  currentUserId: string;
  postId: string;
  reactionCounts: Record<string, number>;
  userReaction: string | undefined;
  onToggleReaction: (emoji: string) => void;
  onClose: () => void;
  onReply: (comment: CommentItemModel) => void;
  onEdit: (comment: CommentItemModel) => void;
  onDelete: (commentId: string) => void | Promise<void>;
}

export function CommentContextMenu({
  comment,
  anchor,
  currentUserId,
  postId,
  reactionCounts,
  userReaction,
  onToggleReaction,
  onClose,
  onReply,
  onEdit,
  onDelete
}: CommentContextMenuProps) {
  const open = Boolean(comment && anchor);

  const style = useMemo(() => {
    if (!anchor) return undefined;
    return popoverPosition(anchor);
  }, [anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!comment || !anchor || !style) return null;

  const own = comment.authorId === currentUserId;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(comment.text);
    } catch {
      /* ignore */
    }
    onClose();
  };

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?commentId=${encodeURIComponent(comment.id)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* ignore */
    }
    onClose();
  };

  const report = () => {
    console.log("report comment", { commentId: comment.id, authorId: comment.authorId, postId });
    onClose();
  };

  return (
    <>
      <div className="ctx-overlay" role="presentation" onClick={onClose} aria-hidden />
      <div
        className="ctx-popover"
        style={style}
        role="dialog"
        aria-label="Меню сообщения"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ctx-reactions-bar">
          {CONTEXT_MENU_REACTION_EMOJIS.map((emoji) => {
            const active = userReaction === emoji;
            const count = reactionCounts[emoji] ?? 0;
            return (
              <button
                key={emoji}
                type="button"
                className={"ctx-reaction-hit" + (active ? " ctx-reaction-hit--active" : "")}
                title={count > 0 ? String(count) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReaction(emoji);
                }}
              >
                {emoji}
              </button>
            );
          })}
          <button
            type="button"
            className="ctx-reaction-plus"
            aria-label="Ещё реакции"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction("➕");
            }}
          >
            +
          </button>
        </div>
        <div className="ctx-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ctx-row" onClick={() => onReply(comment)}>
            <span className="ctx-row__icon" aria-hidden>
              ↩
            </span>
            <span>{COMMENT_CTX_REPLY}</span>
          </button>
          <button type="button" className="ctx-row" onClick={() => void copyText()}>
            <span className="ctx-row__icon" aria-hidden>
              📋
            </span>
            <span>{COMMENT_CTX_COPY_TEXT}</span>
          </button>
          <button type="button" className="ctx-row" onClick={() => void copyLink()}>
            <span className="ctx-row__icon" aria-hidden>
              🔗
            </span>
            <span>{COMMENT_CTX_COPY_LINK}</span>
          </button>
          {!own ? (
            <button type="button" className="ctx-row" onClick={report}>
              <span className="ctx-row__icon" aria-hidden>
                ⚠
              </span>
              <span>{COMMENT_CTX_REPORT}</span>
            </button>
          ) : null}
          {own ? (
            <>
              <button type="button" className="ctx-row" onClick={() => onEdit(comment)}>
                <span className="ctx-row__icon" aria-hidden>
                  ✏️
                </span>
                <span>{COMMENT_CTX_EDIT}</span>
              </button>
              <button
                type="button"
                className="ctx-row ctx-row--danger"
                onClick={() => {
                  void (async () => {
                    await Promise.resolve(onDelete(comment.id));
                    onClose();
                  })();
                }}
              >
                <span className="ctx-row__icon" aria-hidden>
                  🗑
                </span>
                <span>{COMMENT_CTX_DELETE}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
