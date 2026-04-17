import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { authByDevMock, authByInitData, createComment, deleteOwnComment, getComments, getPost, updateOwnComment, uploadCommentImage } from "../../lib/api-client";
import { getInitData, getStartParam } from "../../lib/max-webapp";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";
import { RestrictionBanner } from "../restrictions/restriction-banner";
export function CommentsPage() {
    const [userId, setUserId] = useState("");
    const [postId, setPostId] = useState("");
    const [comments, setComments] = useState([]);
    const [restriction, setRestriction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    async function reloadComments(currentPostId) {
        const response = await getComments(currentPostId);
        const mapped = response.items.map((c) => ({
            id: c.id,
            text: c.text,
            authorId: c.authorId,
            createdAt: c.createdAt,
            isEdited: c.isEdited
        }));
        setComments(mapped);
    }
    useEffect(() => {
        async function init() {
            const startParam = getStartParam();
            const query = new URLSearchParams(window.location.search);
            const postFromQuery = query.get("postId") ?? import.meta.env.VITE_DEV_POST_ID ?? "";
            const resolvedPostId = (startParam?.replace(/^post_/, "") || postFromQuery || "").trim();
            const useDevMock = import.meta.env.VITE_DEV_MAX_AUTH === "true";
            const auth = useDevMock
                ? await authByDevMock({
                    maxUserId: String(import.meta.env.VITE_DEV_MAX_USER_ID ?? "900001"),
                    username: "localdev",
                    chatMaxId: String(import.meta.env.VITE_DEV_CHAT_MAX_ID ?? "-100"),
                    startParam: startParam || (resolvedPostId ? `post_${resolvedPostId}` : undefined)
                })
                : await authByInitData(getInitData());
            setUserId(auth.userId);
            const postIdFromAuth = auth.startParam?.replace(/^post_/, "").trim() ?? "";
            const finalPostId = resolvedPostId || postIdFromAuth;
            setPostId(finalPostId);
            if (finalPostId) {
                const post = await getPost(finalPostId, auth.userId);
                setRestriction(post.restriction);
                await reloadComments(finalPostId);
            }
            setLoading(false);
        }
        void init();
    }, []);
    const canComment = useMemo(() => !restriction, [restriction]);
    if (loading) {
        return _jsx("p", { children: "Loading..." });
    }
    return (_jsxs("main", { style: { maxWidth: 680, margin: "0 auto", padding: 16, display: "grid", gap: 12 }, children: [_jsx("h1", { children: "\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435" }), _jsx(RestrictionBanner, { restriction: restriction }), _jsx(CommentList, { comments: comments, currentUserId: userId, onEdit: (comment) => setEditing(comment), onDelete: async (commentId) => {
                    await deleteOwnComment(commentId, userId);
                    await reloadComments(postId);
                } }), canComment && (_jsx(CommentForm, { submitLabel: editing ? "Update" : "Send", initialText: editing?.text ?? "", onSubmit: async (text, files) => {
                    const attachmentIds = [];
                    for (const file of files) {
                        const uploaded = await uploadCommentImage(file);
                        attachmentIds.push(uploaded.id);
                    }
                    if (editing) {
                        await updateOwnComment(editing.id, userId, text);
                        setEditing(null);
                    }
                    else {
                        await createComment(postId, userId, text, attachmentIds);
                    }
                    await reloadComments(postId);
                } }))] }));
}
