import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { COMMENT_REPLY_PREVIEW_TITLE } from "./comment-ui-strings";
function previewLabel(c) {
    const a = c.author;
    if (a?.firstName || a?.lastName)
        return [a.firstName, a.lastName].filter(Boolean).join(" ") || "Сообщение";
    if (a?.username)
        return a.username.startsWith("@") ? a.username : `@${a.username}`;
    return "Сообщение";
}
export function ReplyPreview({ replyTo, onCancel }) {
    if (!replyTo)
        return null;
    return (_jsxs("div", { className: "reply-preview", children: [_jsxs("div", { className: "reply-preview__body", children: [_jsxs("div", { className: "reply-preview__label", children: [COMMENT_REPLY_PREVIEW_TITLE, ": ", previewLabel(replyTo)] }), _jsx("div", { className: "reply-preview__text", children: replyTo.text })] }), _jsx("button", { type: "button", className: "reply-preview__cancel", onClick: onCancel, children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" })] }));
}
