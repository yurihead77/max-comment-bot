import { jsx as _jsx } from "react/jsx-runtime";
import { CommentItem } from "./comment-item";
export function CommentList({ comments, currentUserId, onEdit, onDelete }) {
    return (_jsx("ul", { style: { listStyle: "none", padding: 0, margin: 0 }, children: comments.map((comment) => (_jsx(CommentItem, { comment: comment, currentUserId: currentUserId, onEdit: onEdit, onDelete: onDelete }, comment.id))) }));
}
