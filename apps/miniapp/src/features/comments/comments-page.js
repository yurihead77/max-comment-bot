import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { authByDevMock, authByInitData, createComment, deleteOwnComment, getComments, getPost, updateOwnComment, uploadCommentImage } from "../../lib/api-client";
import { getStartParam, waitForInitData } from "../../lib/max-webapp";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";
import { RestrictionBanner } from "../restrictions/restriction-banner";
export function CommentsPage() {
    const [userId, setUserId] = useState("");
    const [postId, setPostId] = useState("");
    const [comments, setComments] = useState([]);
    const [restriction, setRestriction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bootstrapError, setBootstrapError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
    function toBootstrapErrorMessage(error) {
        if (!(error instanceof Error))
            return "Ошибка загрузки данных";
        const msg = error.message.toLowerCase();
        if (msg.includes("initdata or devmock is required")) {
            return "MAX не передал initData (попробуйте открыть mini app повторно)";
        }
        if (msg.includes("auth failed") || msg.includes("dev auth failed")) {
            return "Не удалось авторизовать mini app";
        }
        return error.message || "Ошибка загрузки данных";
    }
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
            setLoading(true);
            setBootstrapError(null);
            try {
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
                    : await authByInitData(await waitForInitData());
                setUserId(auth.userId);
                const postIdFromAuth = auth.startParam?.replace(/^post_/, "").trim() ?? "";
                const finalPostId = resolvedPostId || postIdFromAuth;
                setPostId(finalPostId);
                if (finalPostId) {
                    const post = await getPost(finalPostId, auth.userId);
                    setRestriction(post.restriction);
                    await reloadComments(finalPostId);
                }
            }
            catch (error) {
                setBootstrapError(toBootstrapErrorMessage(error));
            }
            finally {
                setLoading(false);
            }
        }
        void init();
    }, [bootstrapAttempt]);
    const canComment = useMemo(() => !restriction, [restriction]);
    if (loading) {
        return _jsx("p", { children: "Loading..." });
    }
    if (bootstrapError) {
        return (_jsxs("main", { style: { maxWidth: 680, margin: "0 auto", padding: 16 }, children: [_jsx("h1", { children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435" }), _jsx("p", { children: bootstrapError }), _jsx("button", { type: "button", onClick: () => setBootstrapAttempt((n) => n + 1), children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" })] }));
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
