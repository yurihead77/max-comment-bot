import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
import { copyTextToClipboard } from "../../lib/clipboard-copy";

const POPOVER_W = 268;
const MARGIN = 8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(lo, n), hi);
}

/** Position fixed popover so it stays inside the visual viewport (client coords already include scroll). */
function clampPopoverBox(
  anchor: { x: number; y: number },
  menuWidth: number,
  menuHeight: number
): { left: number; top: number; width: number; maxHeight: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = vh - MARGIN * 2;
  const effH = Math.min(menuHeight, maxH);
  const w = Math.min(menuWidth, vw - MARGIN * 2);

  let left = anchor.x - w / 2;
  left = clamp(left, MARGIN, vw - w - MARGIN);

  let top = anchor.y - effH - MARGIN;
  if (top < MARGIN) {
    top = anchor.y + MARGIN;
  }
  const maxTop = vh - effH - MARGIN;
  top = clamp(top, MARGIN, Math.max(MARGIN, maxTop));

  return { left, top, width: w, maxHeight: maxH };
}

function estimateMenuHeight(own: boolean): number {
  const reactionBar = 48;
  const row = 44;
  const rows = own ? 5 : 4;
  const padding = 12;
  return reactionBar + rows * row + padding;
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
  canModerate: boolean;
  onModerateDelete: (commentId: string) => void | Promise<void>;
  onMuteUser: (targetUserId: string) => void | Promise<void>;
  onBlockUser: (targetUserId: string) => void | Promise<void>;
  onUnblockUser: (targetUserId: string) => void | Promise<void>;
  targetModerationState: { isSelf: boolean; isTargetModerator: boolean; isMuted: boolean; isBlocked: boolean } | null;
  onReport: (comment: CommentItemModel) => void | Promise<void>;
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
  onDelete,
  canModerate,
  onModerateDelete,
  onMuteUser,
  onBlockUser,
  onUnblockUser,
  targetModerationState,
  onReport
}: CommentContextMenuProps) {
  const open = Boolean(comment && anchor);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | undefined>(undefined);
  const own = comment ? comment.authorId === currentUserId : false;
  const moderationState = targetModerationState;
  const canShowModeratorActions =
    !own &&
    canModerate &&
    Boolean(moderationState) &&
    !moderationState?.isSelf &&
    !moderationState?.isTargetModerator;

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPopoverStyle(undefined);
      return;
    }
    const node = popoverRef.current;
    if (!node) return;

    const apply = () => {
      const rect = node.getBoundingClientRect();
      const h = rect.height || estimateMenuHeight(own);
      const w = rect.width || POPOVER_W;
      const box = clampPopoverBox(anchor, w, h);
      setPopoverStyle({
        position: "fixed",
        left: box.left,
        top: box.top,
        width: box.width,
        maxWidth: `min(${POPOVER_W}px, calc(100vw - ${MARGIN * 2}px))`,
        maxHeight: box.maxHeight,
        zIndex: 1001,
        transform: "none",
        visibility: "visible"
      });
    };

    apply();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => apply());
      ro.observe(node);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [open, anchor, own, comment?.id]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!comment || !anchor) return null;

  const copyText = async () => {
    await copyTextToClipboard(comment.text);
    onClose();
  };

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?commentId=${encodeURIComponent(comment.id)}`;
    await copyTextToClipboard(link);
    onClose();
  };

  const report = () => {
    void (async () => {
      await Promise.resolve(onReport(comment));
      onClose();
    })();
  };

  const est = estimateMenuHeight(own);
  const fallbackStyle: CSSProperties = {
    position: "fixed",
    left: clamp(anchor.x - POPOVER_W / 2, MARGIN, window.innerWidth - POPOVER_W - MARGIN),
    top: clamp(anchor.y - est, MARGIN, window.innerHeight - est - MARGIN),
    width: POPOVER_W,
    maxWidth: `min(${POPOVER_W}px, calc(100vw - ${MARGIN * 2}px))`,
    maxHeight: window.innerHeight - MARGIN * 2,
    zIndex: 1001,
    transform: "none",
    visibility: "hidden"
  };

  return (
    <>
      <div className="ctx-overlay" role="presentation" onClick={onClose} aria-hidden />
      <div
        ref={popoverRef}
        className="ctx-popover"
        style={popoverStyle ?? fallbackStyle}
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
          {canShowModeratorActions ? (
            <>
              <button
                type="button"
                className="ctx-row ctx-row--danger"
                onClick={() => {
                  void (async () => {
                    await Promise.resolve(onModerateDelete(comment.id));
                    onClose();
                  })();
                }}
              >
                <span className="ctx-row__icon" aria-hidden>
                  🛑
                </span>
                <span>Delete (moderator)</span>
              </button>
              <button
                type="button"
                className="ctx-row"
                onClick={() => {
                  void (async () => {
                    await Promise.resolve(onMuteUser(comment.authorId));
                    onClose();
                  })();
                }}
              >
                <span className="ctx-row__icon" aria-hidden>
                  🔇
                </span>
                <span>{targetModerationState?.isMuted ? "Muted" : "Mute user"}</span>
              </button>
              {targetModerationState?.isBlocked ? (
                <button
                  type="button"
                  className="ctx-row"
                  onClick={() => {
                    void (async () => {
                      await Promise.resolve(onUnblockUser(comment.authorId));
                      onClose();
                    })();
                  }}
                >
                  <span className="ctx-row__icon" aria-hidden>
                    ✅
                  </span>
                  <span>Unblock user</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ctx-row"
                  onClick={() => {
                    void (async () => {
                      await Promise.resolve(onBlockUser(comment.authorId));
                      onClose();
                    })();
                  }}
                >
                  <span className="ctx-row__icon" aria-hidden>
                    ⛔
                  </span>
                  <span>Block user</span>
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
