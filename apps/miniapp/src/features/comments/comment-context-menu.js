import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo } from "react";
import { CONTEXT_MENU_REACTION_EMOJIS } from "./comment-reactions";
import { COMMENT_CTX_COPY_LINK, COMMENT_CTX_COPY_TEXT, COMMENT_CTX_DELETE, COMMENT_CTX_EDIT, COMMENT_CTX_REPLY, COMMENT_CTX_REPORT } from "./comment-ui-strings";
const POPOVER_W = 268;
function popoverPosition(anchor) {
    const margin = 10;
    const estH = 340;
    let left = anchor.x - POPOVER_W / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - POPOVER_W - margin));
    let top = anchor.y - estH - margin;
    if (top < margin)
        top = anchor.y + margin;
    top = Math.max(margin, Math.min(top, window.innerHeight - estH - margin));
    return {
        position: "fixed",
        left,
        top,
        width: POPOVER_W,
        maxWidth: `min(${POPOVER_W}px, calc(100vw - ${margin * 2}px))`,
        zIndex: 1001,
        transform: "none"
    };
}
export function CommentContextMenu({ comment, anchor, currentUserId, postId, reactionCounts, userReaction, onToggleReaction, onClose, onReply, onEdit, onDelete }) {
    const open = Boolean(comment && anchor);
    const style = useMemo(() => {
        if (!anchor)
            return undefined;
        return popoverPosition(anchor);
    }, [anchor]);
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
    if (!comment || !anchor || !style)
        return null;
    const own = comment.authorId === currentUserId;
    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(comment.text);
        }
        catch {
            /* ignore */
        }
        onClose();
    };
    const copyLink = async () => {
        const link = `${window.location.origin}${window.location.pathname}?commentId=${encodeURIComponent(comment.id)}`;
        try {
            await navigator.clipboard.writeText(link);
        }
        catch {
            /* ignore */
        }
        onClose();
    };
    const report = () => {
        console.log("report comment", { commentId: comment.id, authorId: comment.authorId, postId });
        onClose();
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "ctx-overlay", role: "presentation", onClick: onClose, "aria-hidden": true }), _jsxs("div", { className: "ctx-popover", style: style, role: "dialog", "aria-label": "\u041C\u0435\u043D\u044E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "ctx-reactions-bar", children: [CONTEXT_MENU_REACTION_EMOJIS.map((emoji) => {
                                const active = userReaction === emoji;
                                const count = reactionCounts[emoji] ?? 0;
                                return (_jsx("button", { type: "button", className: "ctx-reaction-hit" + (active ? " ctx-reaction-hit--active" : ""), title: count > 0 ? String(count) : undefined, onClick: (e) => {
                                        e.stopPropagation();
                                        onToggleReaction(emoji);
                                    }, children: emoji }, emoji));
                            }), _jsx("button", { type: "button", className: "ctx-reaction-plus", "aria-label": "\u0415\u0449\u0451 \u0440\u0435\u0430\u043A\u0446\u0438\u0438", onClick: (e) => {
                                    e.stopPropagation();
                                    onToggleReaction("➕");
                                }, children: "+" })] }), _jsxs("div", { className: "ctx-actions", onClick: (e) => e.stopPropagation(), children: [_jsxs("button", { type: "button", className: "ctx-row", onClick: () => onReply(comment), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u21A9" }), _jsx("span", { children: COMMENT_CTX_REPLY })] }), _jsxs("button", { type: "button", className: "ctx-row", onClick: () => void copyText(), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDCCB" }), _jsx("span", { children: COMMENT_CTX_COPY_TEXT })] }), _jsxs("button", { type: "button", className: "ctx-row", onClick: () => void copyLink(), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDD17" }), _jsx("span", { children: COMMENT_CTX_COPY_LINK })] }), !own ? (_jsxs("button", { type: "button", className: "ctx-row", onClick: report, children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u26A0" }), _jsx("span", { children: COMMENT_CTX_REPORT })] })) : null, own ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "ctx-row", onClick: () => onEdit(comment), children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\u270E" }), _jsx("span", { children: COMMENT_CTX_EDIT })] }), _jsxs("button", { type: "button", className: "ctx-row ctx-row--danger", onClick: () => {
                                            void (async () => {
                                                await Promise.resolve(onDelete(comment.id));
                                                onClose();
                                            })();
                                        }, children: [_jsx("span", { className: "ctx-row__icon", "aria-hidden": true, children: "\uD83D\uDDD1" }), _jsx("span", { children: COMMENT_CTX_DELETE })] })] })) : null] })] })] }));
}
