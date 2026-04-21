import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { getModerationUserState } from "../../lib/api-client";
import { CommentContextMenu } from "./comment-context-menu";
import { CommentItem } from "./comment-item";
import { COMMENT_EMPTY_SUBTITLE, COMMENT_EMPTY_TITLE } from "./comment-ui-strings";
import { MessageList } from "./message-list";
export function CommentList({ comments, currentUserId, selfDisplayHint, postId, onEdit, onDelete, onReply, canModerate, onModerateDelete, onMuteUser, onBlockUser, onUnblockUser }) {
    const scrollRef = useRef(null);
    const [menu, setMenu] = useState(null);
    const [targetModerationState, setTargetModerationState] = useState(null);
    const [reactions, setReactions] = useState({});
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        el.scrollTop = el.scrollHeight;
    }, [comments.length, comments[comments.length - 1]?.id]);
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
                        const grouped = Boolean(prev && prev.authorId === comment.authorId);
                        const showAvatar = !grouped;
                        const reactionState = reactions[comment.id];
                        return (_jsx(CommentItem, { comment: comment, currentUserId: currentUserId, selfDisplayHint: selfDisplayHint, showAvatar: showAvatar, groupedWithPrevious: grouped, onOpenMenu: (c, anchor) => setMenu({ comment: c, x: anchor.x, y: anchor.y }), reactionState: reactionState, onToggleReaction: (emoji) => toggleReaction(comment.id, emoji) }, comment.id));
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
                }, onDelete: (id) => void onDelete(id), canModerate: canModerate, onModerateDelete: (id) => void onModerateDelete(id), onMuteUser: (id) => void onMuteUser(id), onBlockUser: (id) => void onBlockUser(id), onUnblockUser: (id) => void onUnblockUser(id), targetModerationState: targetModerationState })] }));
}
