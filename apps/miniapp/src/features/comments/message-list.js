import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DateDivider, formatDateDividerLabel } from "./date-divider";
function dayKey(iso) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
export function MessageList({ comments, renderMessage }) {
    return (_jsx("div", { className: "chat-list", role: "list", children: comments.map((comment, index) => {
            const prev = comments[index - 1];
            const needDivider = !prev || dayKey(prev.createdAt) !== dayKey(comment.createdAt);
            return (_jsxs("div", { className: "chat-list__entry", children: [needDivider ? _jsx(DateDivider, { label: formatDateDividerLabel(comment.createdAt) }) : null, renderMessage(comment, index)] }, comment.id));
        }) }));
}
