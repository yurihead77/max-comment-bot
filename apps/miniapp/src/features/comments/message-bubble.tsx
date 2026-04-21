import { MessageMeta } from "./message-meta";

interface MessageBubbleProps {
  own: boolean;
  name: string;
  text: string;
  createdAt: string;
  isEdited: boolean;
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
      <MessageMeta name={name} createdAt={createdAt} isEdited={isEdited} />
      <p className="chat-bubble__text">{text}</p>
    </div>
  );
}
