import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CommentItem({ comment, currentUserId, onEdit, onDelete }) {
    const own = comment.authorId === currentUserId;
    return (_jsxs("li", { style: { borderBottom: "1px solid #ddd", padding: "8px 0" }, children: [_jsx("p", { style: { margin: 0 }, children: comment.text }), _jsxs("small", { children: [new Date(comment.createdAt).toLocaleString(), " ", comment.isEdited ? "(edited)" : ""] }), own && (_jsxs("div", { style: { display: "flex", gap: 8, marginTop: 6 }, children: [_jsx("button", { onClick: () => onEdit(comment), children: "Edit" }), _jsx("button", { onClick: () => onDelete(comment.id), children: "Delete" })] }))] }));
}
