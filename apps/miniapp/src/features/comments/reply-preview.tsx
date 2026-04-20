import type { CommentItemModel } from "./comment-item";

export interface ReplyPreviewProps {
  replyTo: CommentItemModel | null;
  onCancel: () => void;
}

function previewLabel(c: CommentItemModel): string {
  const a = c.author;
  if (a?.firstName || a?.lastName) return [a.firstName, a.lastName].filter(Boolean).join(" ") || "Сообщение";
  if (a?.username) return a.username.startsWith("@") ? a.username : `@${a.username}`;
  return "Сообщение";
}

export function ReplyPreview({ replyTo, onCancel }: ReplyPreviewProps) {
  if (!replyTo) return null;
  return (
    <div className="reply-preview">
      <div className="reply-preview__body">
        <div className="reply-preview__label">Ответ на: {previewLabel(replyTo)}</div>
        <div className="reply-preview__text">{replyTo.text}</div>
      </div>
      <button type="button" className="reply-preview__cancel" onClick={onCancel}>
        Отменить
      </button>
    </div>
  );
}
