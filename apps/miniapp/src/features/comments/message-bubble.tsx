import { MessageMeta } from "./message-meta";

interface MessageBubbleProps {
  own: boolean;
  name: string;
  text: string;
  createdAt: string;
  isEdited: boolean;
  replyPreview?: {
    id: string;
    authorName: string;
    textSnippet: string;
  } | null;
  onReplyPreviewClick?: (commentId: string) => void;
  showMenu?: boolean;
  onOpenMenuAt: (x: number, y: number) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onTouchMove: () => void;
}

export function MessageBubble({
  own,
  name,
  text,
  createdAt,
  isEdited,
  replyPreview,
  onReplyPreviewClick,
  showMenu = true,
  onOpenMenuAt,
  onClick,
  onContextMenu,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onTouchMove
}: MessageBubbleProps) {
  return (
    <div
      className={"chat-bubble " + (own ? "chat-bubble--own" : "chat-bubble--other")}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onTouchMove={onTouchMove}
    >
      {showMenu ? (
        <button
          type="button"
          className="chat-bubble__menu-hit"
          aria-label="Меню сообщения"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            onOpenMenuAt(r.left + r.width / 2, r.bottom);
          }}
        >
          ⋯
        </button>
      ) : null}
      <MessageMeta name={name} createdAt={createdAt} isEdited={isEdited} />
      {replyPreview ? (
        <button
          type="button"
          className="chat-bubble__reply-quote"
          onClick={(e) => {
            e.stopPropagation();
            onReplyPreviewClick?.(replyPreview.id);
          }}
          aria-label={`Перейти к комментарию ${replyPreview.authorName}`}
        >
          <span className="chat-bubble__reply-author">{replyPreview.authorName}</span>
          <span className="chat-bubble__reply-text">{replyPreview.textSnippet}</span>
        </button>
      ) : null}
      <p className="chat-bubble__text">{text}</p>
    </div>
  );
}
