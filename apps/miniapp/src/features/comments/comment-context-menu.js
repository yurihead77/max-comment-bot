import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { COMMENT_CTX_COPY_LINK, COMMENT_CTX_COPY_TEXT, COMMENT_CTX_DELETE, COMMENT_CTX_EDIT, COMMENT_CTX_REPLY, COMMENT_CTX_REPORT } from "./comment-ui-strings";
export function CommentContextMenu({ comment, anchor, currentUserId, postId, onClose, onReply, onEdit, onDelete }) {
    const open = Boolean(comment && anchor);
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
    const own = comment.authorId === currentUserId;
    const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
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
    const sheetStyle = desktop
        ? {
            position: "fixed",
            left: Math.min(Math.max(anchor.x - 110, 8), window.innerWidth - 228),
            top: Math.max(anchor.y - 8, 8),
            transform: "translateY(-100%)"
        }
        : {};
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "ctx-overlay", role: "presentation", onClick: onClose }), _jsxs("div", { className: "ctx-sheet " + (desktop ? "ctx-sheet--desktop" : "ctx-sheet--mobile"), style: sheetStyle, role: "menu", "aria-label": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435\u043C", children: [_jsx("button", { type: "button", className: "ctx-item", role: "menuitem", onClick: () => onReply(comment), children: COMMENT_CTX_REPLY }), _jsx("button", { type: "button", className: "ctx-item", role: "menuitem", onClick: () => void copyText(), children: COMMENT_CTX_COPY_TEXT }), _jsx("button", { type: "button", className: "ctx-item", role: "menuitem", onClick: () => void copyLink(), children: COMMENT_CTX_COPY_LINK }), own ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "ctx-item", role: "menuitem", onClick: () => onEdit(comment), children: COMMENT_CTX_EDIT }), _jsx("button", { type: "button", className: "ctx-item ctx-item--danger", role: "menuitem", onClick: () => {
                                    void (async () => {
                                        await Promise.resolve(onDelete(comment.id));
                                        onClose();
                                    })();
                                }, children: COMMENT_CTX_DELETE })] })) : (_jsx("button", { type: "button", className: "ctx-item", role: "menuitem", onClick: report, children: COMMENT_CTX_REPORT }))] })] }));
}
