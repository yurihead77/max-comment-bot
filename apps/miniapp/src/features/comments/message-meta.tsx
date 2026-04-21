interface MessageMetaProps {
  name: string;
  createdAt: string;
  isEdited: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MessageMeta({ name, createdAt, isEdited }: MessageMetaProps) {
  return (
    <div className="chat-bubble__meta">
      <span className="chat-bubble__name">{name}</span>
      <span className="chat-bubble__time">
        {formatTime(createdAt)}
        {isEdited ? " · изменено" : ""}
      </span>
    </div>
  );
}
