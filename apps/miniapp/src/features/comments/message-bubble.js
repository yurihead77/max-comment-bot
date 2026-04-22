import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MessageMeta } from "./message-meta";
export function MessageBubble({ own, name, text, createdAt, isEdited, replyPreview, onReplyPreviewClick, showMenu = true, onOpenMenuAt, onClick, onContextMenu, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, onTouchMove }) {
    return (_jsxs("div", { className: "chat-bubble " + (own ? "chat-bubble--own" : "chat-bubble--other"), onClick: onClick, onContextMenu: onContextMenu, onPointerDown: onPointerDown, onPointerUp: onPointerUp, onPointerCancel: onPointerCancel, onPointerLeave: onPointerLeave, onTouchMove: onTouchMove, children: [showMenu ? (_jsx("button", { type: "button", className: "chat-bubble__menu-hit", "aria-label": "\u041C\u0435\u043D\u044E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    onOpenMenuAt(r.left + r.width / 2, r.bottom);
                }, children: "\u22EF" })) : null, _jsx(MessageMeta, { name: name, createdAt: createdAt, isEdited: isEdited }), replyPreview ? (_jsxs("button", { type: "button", className: "chat-bubble__reply-quote", onClick: (e) => {
                    e.stopPropagation();
                    onReplyPreviewClick?.(replyPreview.id);
                }, "aria-label": `Перейти к комментарию ${replyPreview.authorName}`, children: [_jsx("span", { className: "chat-bubble__reply-author", children: replyPreview.authorName }), _jsx("span", { className: "chat-bubble__reply-text", children: replyPreview.textSnippet })] })) : null, _jsx("p", { className: "chat-bubble__text", children: text })] }));
}
