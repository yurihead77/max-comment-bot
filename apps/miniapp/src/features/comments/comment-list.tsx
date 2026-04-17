import { CommentItem, type CommentItemModel } from "./comment-item";

interface CommentListProps {
  comments: CommentItemModel[];
  currentUserId: string;
  onEdit: (comment: CommentItemModel) => void;
  onDelete: (commentId: string) => void;
}

export function CommentList({ comments, currentUserId, onEdit, onDelete }: CommentListProps) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
