import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CONTEXT_MENU_REACTION_EMOJIS } from "./comment-reactions";
import { COMMENT_CTX_COPY_LINK, COMMENT_CTX_COPY_TEXT, COMMENT_CTX_DELETE, COMMENT_CTX_EDIT, COMMENT_CTX_REPLY, COMMENT_CTX_REPORT } from "./comment-ui-strings";
import { copyTextToClipboard } from "../../lib/clipboard-copy";
const POPOVER_W = 268;
const MARGIN = 8;
function clamp(n, lo, hi) {
    return Math.min(Math.max(lo, n), hi);
}
/** Position fixed popover so it stays inside the visual viewport (client coords already include scroll). */
function clampPopoverBox(anchor, menuWidth, menuHeight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxH = vh - MARGIN * 2;
    const effH = Math.min(menuHeight, maxH);
    const w = Math.min(menuWidth, vw - MARGIN * 2);
    let left = anchor.x - w / 2;
    left = clamp(left, MARGIN, vw - w - MARGIN);
    let top = anchor.y - effH - MARGIN;
    if (top < MARGIN) {
        top = anchor.y + MARGIN;
    }
    const maxTop = vh - effH - MARGIN;
    top = clamp(top, MARGIN, Math.max(MARGIN, maxTop));
    return { left, top, width: w, maxHeight: maxH };
}
function estimateMenuHeight(own) {
    const reactionBar = 48;
    const row = 44;
    const rows = own ? 5 : 4;
    const padding = 12;
    return reactionBar + rows * row + padding;
}
export function CommentContextMenu({ comment, anchor, currentUserId, postId, reactionCounts, userReaction, onToggleReaction, onClose, onReply, onEdit, onDelete }) {
    const open = Boolean(comment && anchor);
    const popoverRef = useRef(null);
    const [popoverStyle, setPopoverStyle] = useState(undefined);
    const own = comment ? comment.authorId === currentUserId : false;
    useLayoutEffect(() => {
        if (!open || !anchor) {
            setPopoverStyle(undefined);
            return;
        }
        const node = popoverRef.current;
        if (!node)
            return;
        const apply = () => {
            const rect = node.getBoundingClientRect();
            const h = rect.height || estimateMenuHeight(own);
            const w = rect.width || POPOVER_W;
            const box = clampPopoverBox(anchor, w, h);
            setPopoverStyle({
                position: "fixed",
                left: box.left,
                top: box.top,
                width: box.width,
                maxWidth: `min(${POPOVER_W}px, calc(100vw - ${MARGIN * 2}px))`,
                maxHeight: box.maxHeight,
                zIndex: 1001,
                transform: "none",
                visibility: "visible"
            });
        };
        apply();
        let ro;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(() => apply());
            ro.observe(node);
        }
        window.addEventListener("resize", apply);
        return () => {
            ro?.disconnect();
            window.removeEventListener("resize", apply);
        };
    }, [open, anchor, own, comment?.id]);
    useEffect(() => {
        if (!open)
            return;
        const body = document.body;
        const html = document.documentElement;
        const prevBody = body.style.overflow;
        const prevHtml = html.style.overflow;
        body.style.overflow = "hidden";
        html.style.overflow = "hidden";
        return () => {
            body.style.overflow = prevBody;
            html.style.overflow = prevHtml;
        };
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!comment || !anchor)
        return null;
    const copyText = async () => {
        await copyTextToClipboard(comment.text);
        onClose();
    };
    const copyLink = async () => {
        const link = `${window.location.origin}${window.location.pathname}?commentId=${encodeURIComponent(comment.id)}`;
        await copyTextToClipboard(link);
        onClose();
    };
    const report = () => {
        console.log("report comment", { commentId: comment.id, authorId: comment.authorId, postId });
        onClose();
    };
    const est = estimateMenuHeight(own);
    const fallbackStyle = {
        position: "fixed",
        left: clamp(anchor.x - POPOVER_W / 2, MARGIN, window.innerWidth - POPOVER_W - MARGIN),
        top: clamp(anchor.y - est, MARGIN, window.innerHeight - est - MARGIN),
        width: POPOVER_W,
        maxWidth: `min(${POPOVER_W}px, calc(100vw - ${MARGIN * 2}px))`,
        maxHeight: window.innerHeight - MARGIN * 2,
        zIndex: 1001,
        transform: "none",
        visibility: "hidden"
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "ctx-overlay", role: "presentation", onClick: onClose, "aria-hidden": true }), _jsxs("div", { ref: popoverRef, className: "ctx-popover", style: popoverStyle ?? fallbackStyle, role: "dialog", "aria-label": "\u041C\u0435\u043D\u044E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "ctx-reactions-bar", children: [CONTEXT_MENU_REACTION_EMOJIS.map((emoji) => {
                                const active = userReaction === emoji;
                                const count = reactionCounts[emoji] ?? 0;
                                return (_jsx("button", { type: "button", className: "ctx-reaction-hit" + (active ? " ctx-reaction-hit--active" : ""), title: count > 0 ? String(count) : undefined, onClick: (e) => {
                                        e.stopPropagation();
                                        onToggleReaction(emoji);
                                    }, children: emoji }, emoji));
                            }), _jsx("button", { type: "button", className: "ctx-reaction-plus", "aria-label": "\u0415\u0449\u0451 \u0440\u0435\u0430\u043A\u0446\u0438\u0438", onClick: (e) => {
                                    e.stopPropagation();
                                    onToggleReaction("➕");
                                }, children: "+" })] }), _jsxs("div", { className: "ctx-actions", onClick: (e) => e.stopPropagation(), children: [_jsxs("button", { type: "button", className: "ctx-row", onClick: () => onReply(comment), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u21A9" }), _jsx("span", { children: COMMENT_CTX_REPLY })] }), _jsxs("button", { type: "button", className: "ctx-row", onClick: () => void copyText(), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDCCB" }), _jsx("span", { children: COMMENT_CTX_COPY_TEXT })] }), _jsxs("button", { type: "button", className: "ctx-row", onClick: () => void copyLink(), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDD17" }), _jsx("span", { children: COMMENT_CTX_COPY_LINK })] }), !own ? (_jsxs("button", { type: "button", className: "ctx-row", onClick: report, children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u26A0" }), _jsx("span", { children: COMMENT_CTX_REPORT })] })) : null, own ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "ctx-row", onClick: () => onEdit(comment), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u270F\uFE0F" }), _jsx("span", { children: COMMENT_CTX_EDIT })] }), _jsxs("button", { type: "button", className: "ctx-row ctx-row--danger", onClick: () => {
                                            void (async () => {
                                                await Promise.resolve(onDelete(comment.id));
                                                onClose();
                                            })();
                                        }, children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDDD1" }), _jsx("span", { children: COMMENT_CTX_DELETE })] })] })) : null] })] })] }));
}
