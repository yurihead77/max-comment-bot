import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
export function MessageMeta({ name, createdAt, isEdited }) {
    return (_jsxs("div", { className: "chat-bubble__meta", children: [_jsx("span", { className: "chat-bubble__name", children: name }), _jsxs("span", { className: "chat-bubble__time", children: [formatTime(createdAt), isEdited ? " · изменено" : ""] })] }));
}
