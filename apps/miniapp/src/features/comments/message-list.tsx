import type { ReactNode } from "react";
import { DateDivider, formatDateDividerLabel } from "./date-divider";
import type { CommentItemModel } from "./comment-item";

interface MessageListProps {
  comments: CommentItemModel[];
  renderMessage: (comment: CommentItemModel, index: number) => ReactNode;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MessageList({ comments, renderMessage }: MessageListProps) {
  return (
    <div className="chat-list" role="list">
      {comments.map((comment, index) => {
        const prev = comments[index - 1];
        const needDivider = !prev || dayKey(prev.createdAt) !== dayKey(comment.createdAt);
        return (
          <div key={comment.id} className="chat-list__entry">
            {needDivider ? <DateDivider label={formatDateDividerLabel(comment.createdAt)} /> : null}
            {renderMessage(comment, index)}
          </div>
        );
      })}
    </div>
  );
}
