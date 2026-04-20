import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useRef } from "react";
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 12;
function authorDisplayName(author) {
    if (!author)
        return null;
    const parts = [author.firstName, author.lastName].filter(Boolean);
    if (parts.length)
        return parts.join(" ");
    if (author.username)
        return author.username.startsWith("@") ? author.username : `@${author.username}`;
    return null;
}
function resolveDisplayName(comment, currentUserId, selfDisplayHint) {
    const fromApi = authorDisplayName(comment.author);
    if (fromApi)
        return fromApi;
    if (comment.authorId === currentUserId && selfDisplayHint?.trim())
        return selfDisplayHint.trim();
    return "Пользователь";
}
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    const w = parts[0] ?? "?";
    return w.slice(0, 2).toUpperCase();
}
function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
export function CommentItem({ comment, currentUserId, selfDisplayHint, showAvatar, groupedWithPrevious, onOpenMenu }) {
    const own = comment.authorId === currentUserId;
    const name = resolveDisplayName(comment, currentUserId, selfDisplayHint);
    const longPressTimer = useRef(undefined);
    const longPressListeners = useRef(null);
    const longPressAnchor = useRef(null);
    const clearLongPress = useCallback(() => {
        if (longPressTimer.current !== undefined) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = undefined;
        }
        const l = longPressListeners.current;
        if (l) {
            window.removeEventListener("pointermove", l.move);
            window.removeEventListener("pointerup", l.end);
            window.removeEventListener("pointercancel", l.end);
            longPressListeners.current = null;
        }
        longPressAnchor.current = null;
    }, []);
    const openAt = (clientX, clientY) => {
        onOpenMenu(comment, { x: clientX, y: clientY });
    };
    const onContextMenu = (e) => {
        e.preventDefault();
        openAt(e.clientX, e.clientY);
    };
    const onBubbleClick = (e) => {
        if (e.target.closest(".chat-bubble__menu-hit"))
            return;
        const sel = typeof window !== "undefined" ? window.getSelection?.()?.toString() ?? "" : "";
        if (sel.length > 0)
            return;
        openAt(e.clientX, e.clientY);
    };
    const onPointerDown = (e) => {
        if (e.button !== 0)
            return;
        if (e.target.closest(".chat-bubble__menu-hit"))
            return;
        clearLongPress();
        const start = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
        longPressAnchor.current = start;
        const onMove = (ev) => {
            if (longPressAnchor.current?.pointerId !== ev.pointerId)
                return;
            const ax = longPressAnchor.current.x;
            const ay = longPressAnchor.current.y;
            const dx = ev.clientX - ax;
            const dy = ev.clientY - ay;
            if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
                clearLongPress();
            }
        };
        const onEnd = () => {
            clearLongPress();
        };
        longPressListeners.current = { move: onMove, end: onEnd };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd);
        window.addEventListener("pointercancel", onEnd);
        longPressTimer.current = window.setTimeout(() => {
            longPressTimer.current = undefined;
            const l = longPressListeners.current;
            if (l) {
                window.removeEventListener("pointermove", l.move);
                window.removeEventListener("pointerup", l.end);
                window.removeEventListener("pointercancel", l.end);
                longPressListeners.current = null;
            }
            if (longPressAnchor.current?.pointerId === start.pointerId) {
                openAt(start.x, start.y);
            }
            longPressAnchor.current = null;
        }, LONG_PRESS_MS);
    };
    const onTouchMove = () => {
        clearLongPress();
    };
    const rowClass = "chat-row" +
        (own ? " chat-row--own" : "") +
        (groupedWithPrevious ? " chat-row--grouped" : "");
    return (_jsx("li", { className: rowClass, "data-comment-id": comment.id, "data-author-id": comment.authorId, "data-user-id": comment.authorId, children: _jsxs("div", { className: "chat-bubble-wrap", children: [_jsx("div", { className: "chat-avatar-slot", "aria-hidden": !showAvatar, children: showAvatar ? (_jsx("div", { className: "chat-avatar", children: comment.author?.photoUrl ? (_jsx("img", { src: comment.author.photoUrl, alt: "", width: 36, height: 36 })) : (initials(name)) })) : null }), _jsxs("div", { className: "chat-bubble " + (own ? "chat-bubble--own" : "chat-bubble--other"), onClick: onBubbleClick, onContextMenu: onContextMenu, onPointerDown: onPointerDown, onPointerUp: clearLongPress, onPointerCancel: clearLongPress, onPointerLeave: clearLongPress, onTouchMove: onTouchMove, children: [_jsx("button", { type: "button", className: "chat-bubble__menu-hit", "aria-label": "\u041C\u0435\u043D\u044E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                                e.stopPropagation();
                                const r = e.currentTarget.getBoundingClientRect();
                                openAt(r.left + r.width / 2, r.bottom);
                            }, children: "\u22EF" }), _jsxs("div", { className: "chat-bubble__meta", children: [_jsx("span", { className: "chat-bubble__name", children: name }), _jsxs("span", { className: "chat-bubble__time", children: [formatTime(comment.createdAt), comment.isEdited ? " · изменено" : ""] })] }), _jsx("p", { className: "chat-bubble__text", children: comment.text })] })] }) }));
}
