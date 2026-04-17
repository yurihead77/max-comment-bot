import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CommentDetails({ item }) {
    if (!item) {
        return _jsx("p", { children: "Select a comment" });
    }
    return (_jsxs("section", { style: { border: "1px solid #ddd", padding: 12, borderRadius: 8 }, children: [_jsx("h3", { children: "Comment details" }), _jsxs("p", { children: ["ID: ", item.id] }), _jsxs("p", { children: ["Status: ", item.status] }), _jsxs("p", { children: ["Author ID: ", item.authorId] }), _jsxs("p", { children: ["Text: ", item.text] })] }));
}
