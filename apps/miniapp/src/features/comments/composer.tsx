import type { CommentItemModel } from "./comment-item";
import { CommentInput } from "./comment-input";
import { ReplyPreview } from "./reply-preview";

interface ComposerProps {
  editingMessage: CommentItemModel | null;
  replyToMessage: CommentItemModel | null;
  onCancelReply: () => void;
  onSubmit: (text: string, files: File[]) => Promise<void>;
}

export function Composer({ editingMessage, replyToMessage, onCancelReply, onSubmit }: ComposerProps) {
  return (
    <div className="comments-app__composer">
      {!editingMessage ? <ReplyPreview replyTo={replyToMessage} onCancel={onCancelReply} /> : null}
      <CommentInput
        submitLabel={editingMessage ? "Сохранить" : "Отправить"}
        initialText={editingMessage?.text ?? ""}
        replyTo={editingMessage ? null : replyToMessage}
        onCancelReply={onCancelReply}
        onSubmit={onSubmit}
      />
    </div>
  );
}
