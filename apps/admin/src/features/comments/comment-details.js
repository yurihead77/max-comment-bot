import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CommentDetails({ item }) {
    if (!item) {
        return _jsx("p", { children: "Select a comment" });
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h3", { children: "Comment details" }), _jsxs("p", { children: ["ID: ", item.id] }), _jsxs("p", { children: ["Status: ", item.status] }), _jsxs("p", { children: ["Author ID: ", item.authorId] }), _jsxs("p", { children: ["Author MAX User ID: ", item.author?.maxUserId || "-"] }), _jsxs("p", { children: ["Text: ", item.text] }), _jsxs("p", { children: ["Created: ", item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"] }), _jsxs("p", { children: ["Updated: ", item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"] }), _jsxs("p", { children: ["Post: ", item.postId] }), _jsxs("p", { children: ["Channel: ", item.post?.chat?.title || item.post?.chat?.maxChatId || "-"] })] }));
}
