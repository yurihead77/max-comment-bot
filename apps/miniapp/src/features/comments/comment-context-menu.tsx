import { useEffect, type CSSProperties } from "react";
import type { CommentItemModel } from "./comment-item";

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
    const u = new URL(window.location.href);
    u.searchParams.set("postId", postId);
    u.searchParams.set("commentId", comment.id);
    const link = `${u.origin}${u.pathname}?${u.searchParams.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* ignore */
    }
    onClose();
  };

  const report = () => {
    console.log("report comment", { commentId: comment.id, authorId: comment.authorId });
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
          Ответить
        </button>
        <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyText()}>
          Скопировать текст
        </button>
        <button type="button" className="ctx-item" role="menuitem" onClick={() => void copyLink()}>
          Скопировать ссылку
        </button>
        {own ? (
          <>
            <button type="button" className="ctx-item" role="menuitem" onClick={() => onEdit(comment)}>
              Изменить
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
              Удалить
            </button>
          </>
        ) : (
          <button type="button" className="ctx-item" role="menuitem" onClick={report}>
            Пожаловаться
          </button>
        )}
      </div>
    </>
  );
}
