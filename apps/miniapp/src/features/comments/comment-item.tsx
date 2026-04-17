export interface CommentItemModel {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  isEdited: boolean;
}

interface CommentItemProps {
  comment: CommentItemModel;
  currentUserId: string;
  onEdit: (comment: CommentItemModel) => void;
  onDelete: (commentId: string) => void;
}

export function CommentItem({ comment, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const own = comment.authorId === currentUserId;
  return (
    <li style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
      <p style={{ margin: 0 }}>{comment.text}</p>
      <small>
        {new Date(comment.createdAt).toLocaleString()} {comment.isEdited ? "(edited)" : ""}
      </small>
      {own && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={() => onEdit(comment)}>Edit</button>
          <button onClick={() => onDelete(comment.id)}>Delete</button>
        </div>
      )}
    </li>
  );
}
