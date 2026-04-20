import { useEffect, type CSSProperties } from "react";
import type { CommentItemModel } from "./comment-item";
import {
  COMMENT_CTX_COPY_LINK,
  COMMENT_CTX_COPY_TEXT,
  COMMENT_CTX_DELETE,
  COMMENT_CTX_EDIT,
  COMMENT_CTX_REPLY,
  COMMENT_CTX_REPORT
} from "./comment-ui-strings";

export interface CommentContextMenuProps {
  comment: CommentItemModel | null;
  anchor: { x: number; y: number } | null;
  currentUserId: string;
  postId: string;
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
  onClose,
  onReply,
  onEdit,
  onDelete
}: CommentContextMenuProps) {
  const open = Boolean(comment && anchor);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!comment || !anchor) return null;

  const own = comment.authorId === currentUserId;
  const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

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

  const sheetStyle: CSSProperties = desktop
    ? {
        position: "fixed",
        left: Math.min(Math.max(anchor.x - 110, 8), window.innerWidth - 228),
        top: Math.max(anchor.y - 8, 8),
        transform: "translateY(-100%)"
      }
    : {};

  return (
    <>
      <div className="ctx-overlay" role="presentation" onClick={onClose} />
      <div
        className={"ctx-sheet " + (desktop ? "ctx-sheet--desktop" : "ctx-sheet--mobile")}
        style={sheetStyle}
        role="menu"
        aria-label="Действия с сообщением"
      >
        <button type="button" className="ctx-item" role="menuitem" onClick={() => onReply(comment)}>
          {COMMENT_CTX_REPLY}
        </button>
        <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyText()}>
          {COMMENT_CTX_COPY_TEXT}
        </button>
        <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyLink()}>
          {COMMENT_CTX_COPY_LINK}
        </button>
        {own ? (
          <>
            <button type="button" className="ctx-item" role="menuitem" onClick={() => onEdit(comment)}>
              {COMMENT_CTX_EDIT}
            </button>
            <button
              type="button"
              className="ctx-item ctx-item--danger"
              role="menuitem"
              onClick={() => {
                void (async () => {
                  await Promise.resolve(onDelete(comment.id));
                  onClose();
                })();
              }}
            >
              {COMMENT_CTX_DELETE}
            </button>
          </>
        ) : (
          <button type="button" className="ctx-item" role="menuitem" onClick={report}>
            {COMMENT_CTX_REPORT}
          </button>
        )}
      </div>
    </>
  );
}
