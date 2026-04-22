import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { getModerationUserState } from "../../lib/api-client";
import { CommentContextMenu } from "./comment-context-menu";
import { CommentItem } from "./comment-item";
import { COMMENT_EMPTY_SUBTITLE, COMMENT_EMPTY_TITLE } from "./comment-ui-strings";
import { MessageList } from "./message-list";
export function CommentList({ comments, currentUserId, selfDisplayHint, postId, highlightCommentId, reportBadge, reportModMenu, onEdit, onDelete, onReply, canModerate, onModerateDelete, onMuteUser, onBlockUser, onUnblockUser, onReport }) {
    const scrollRef = useRef(null);
    const flashTimerRef = useRef(null);
    const [menu, setMenu] = useState(null);
    const [jumpHighlightId, setJumpHighlightId] = useState(null);
    const [targetModerationState, setTargetModerationState] = useState(null);
    const [reactions, setReactions] = useState({});
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        el.scrollTop = el.scrollHeight;
    }, [comments.length, comments[comments.length - 1]?.id]);
    useEffect(() => {
        if (!highlightCommentId || !scrollRef.current)
            return;
        const row = scrollRef.current.querySelector(`[data-comment-id="${highlightCommentId}"]`);
        if (row) {
            row.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [highlightCommentId, comments]);
    useEffect(() => {
        return () => {
            if (flashTimerRef.current !== null) {
                window.clearTimeout(flashTimerRef.current);
            }
        };
    }, []);
    const jumpToComment = (targetCommentId) => {
        const row = scrollRef.current?.querySelector(`[data-comment-id="${targetCommentId}"]`);
        if (!row)
            return;
        row.scrollIntoView({ block: "center", behavior: "smooth" });
        setJumpHighlightId(targetCommentId);
        if (flashTimerRef.current !== null) {
            window.clearTimeout(flashTimerRef.current);
        }
        flashTimerRef.current = window.setTimeout(() => {
            setJumpHighlightId((prev) => (prev === targetCommentId ? null : prev));
            flashTimerRef.current = null;
        }, 1400);
    };
    const toggleReaction = (commentId, emoji) => {
        setReactions((prev) => {
            const curEntry = prev[commentId] ?? { counts: {} };
            const counts = { ...curEntry.counts };
            const prevPick = curEntry.pick;
            let pick = prevPick;
            if (prevPick === emoji) {
                pick = undefined;
                counts[emoji] = Math.max(0, (counts[emoji] ?? 1) - 1);
            }
            else {
                if (prevPick && counts[prevPick])
                    counts[prevPick] = Math.max(0, counts[prevPick] - 1);
                pick = emoji;
                counts[emoji] = (counts[emoji] ?? 0) + 1;
            }
            return { ...prev, [commentId]: { counts, pick } };
        });
    };
    const empty = comments.length === 0;
    const menuId = menu?.comment.id;
    const menuReactions = menuId ? reactions[menuId] : undefined;
    useEffect(() => {
        if (!menu?.comment || !canModerate || menu.comment.authorId === currentUserId) {
            setTargetModerationState(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const state = await getModerationUserState(currentUserId, menu.comment.authorId);
                if (!cancelled) {
                    setTargetModerationState({
                        isSelf: state.isSelf,
                        isTargetModerator: state.isTargetModerator,
                        isMuted: state.isMuted,
                        isBlocked: state.isBlocked
                    });
                }
            }
            catch {
                if (!cancelled) {
                    setTargetModerationState(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [menu?.comment?.id, canModerate, currentUserId]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "comments-app__scroll", ref: scrollRef, children: empty ? (_jsxs("div", { className: "chat-empty", "aria-live": "polite", children: [_jsx("p", { className: "chat-empty__title", children: COMMENT_EMPTY_TITLE }), _jsx("p", { className: "chat-empty__subtitle", children: COMMENT_EMPTY_SUBTITLE })] })) : (_jsx(MessageList, { comments: comments, renderMessage: (comment, index) => {
                        const prev = comments[index - 1];
                        const grouped = Boolean(prev &&
                            (prev.kind ?? "comment") === "comment" &&
                            (comment.kind ?? "comment") === "comment" &&
                            prev.authorId &&
                            comment.authorId &&
                            prev.authorId === comment.authorId);
                        const showAvatar = (comment.kind ?? "comment") === "comment";
                        const reactionState = reactions[comment.id];
                        const badge = reportBadge && reportBadge.commentId === comment.id
                            ? {
                                openCount: reportBadge.openCount,
                                linkedReportClosed: reportBadge.linkedReportClosed
                            }
                            : undefined;
                        const rowHighlight = highlightCommentId === comment.id || jumpHighlightId === comment.id;
                        const showDiscussionStartDivider = (comment.kind ?? "comment") === "thread_header" &&
                            index + 1 < comments.length &&
                            (comments[index + 1]?.kind ?? "comment") !== "thread_header";
                        return (_jsxs("div", { children: [_jsx(CommentItem, { comment: comment, currentUserId: currentUserId, selfDisplayHint: selfDisplayHint, showAvatar: showAvatar, groupedWithPrevious: grouped, reportHighlight: rowHighlight, reportBadge: badge, onOpenMenu: (c, anchor) => setMenu({ comment: c, x: anchor.x, y: anchor.y }), reactionState: reactionState, onToggleReaction: (emoji) => toggleReaction(comment.id, emoji), onJumpToComment: jumpToComment }), showDiscussionStartDivider ? (_jsxs("div", { className: "thread-start-divider", role: "separator", "aria-label": "\u041D\u0430\u0447\u0430\u043B\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F", children: [_jsx("span", { className: "thread-start-divider__line" }), _jsx("span", { className: "thread-start-divider__label", children: "\u041D\u0430\u0447\u0430\u043B\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F" }), _jsx("span", { className: "thread-start-divider__line" })] })) : null] }, comment.id));
                    } })) }), _jsx(CommentContextMenu, { comment: menu?.comment ?? null, anchor: menu ? { x: menu.x, y: menu.y } : null, currentUserId: currentUserId, postId: postId, reactionCounts: menuReactions?.counts ?? {}, userReaction: menuReactions?.pick, onToggleReaction: menuId
                    ? (emoji) => {
                        toggleReaction(menuId, emoji);
                    }
                    : () => { }, onClose: () => setMenu(null), onReply: (c) => {
                    onReply(c);
                    setMenu(null);
                }, onEdit: (c) => {
                    onEdit(c);
                    setMenu(null);
                }, onDelete: (id) => void onDelete(id), canModerate: canModerate, onModerateDelete: (id) => void onModerateDelete(id), onMuteUser: (id) => void onMuteUser(id), onBlockUser: (id) => void onBlockUser(id), onUnblockUser: (id) => void onUnblockUser(id), targetModerationState: targetModerationState, onReport: (c) => void onReport(c), reportModMenu: reportModMenu && menu?.comment && menu.comment.id === reportModMenu.anchorCommentId
                    ? { onResolveKeep: reportModMenu.onResolveKeep }
                    : undefined })] }));
}
