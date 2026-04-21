import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { authByDevMock, authByInitData, blockUserByModerator, createComment, deleteOwnComment, reportComment, getMeRole, getComments, getPost, getModerationReportContext, moderateCommentByModerator, muteUserByModerator, resolveModerationReportKeep, unblockUserByModerator, updateOwnComment, uploadCommentImage } from "../../lib/api-client";
import { parseReportIdFromStartParam } from "../../lib/report-deeplink";
import { getInitDataUnsafeUser, getStartParam, waitForInitData } from "../../lib/max-webapp";
import { CommentList } from "./comment-list";
import { RestrictionBanner } from "../restrictions/restriction-banner";
import { COMMENT_NO_POST } from "./comment-ui-strings";
import { Composer } from "./composer";
import "./comments-chat.css";
function hintFromInitDataUnsafeUser() {
    const u = getInitDataUnsafeUser();
    if (!u)
        return null;
    const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    if (full)
        return full;
    if (u.username)
        return u.username.startsWith("@") ? u.username : `@${u.username}`;
    return null;
}
export function CommentsPage() {
    const [userId, setUserId] = useState("");
    const [postId, setPostId] = useState("");
    const [comments, setComments] = useState([]);
    const [restriction, setRestriction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bootstrapError, setBootstrapError] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [selfDisplayHint, setSelfDisplayHint] = useState(null);
    const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
    const [role, setRole] = useState("user");
    const [reportDeepLink, setReportDeepLink] = useState(null);
    function toBootstrapErrorMessage(error) {
        if (!(error instanceof Error))
            return "Ошибка загрузки данных";
        const msg = error.message.toLowerCase();
        if (msg.includes("initdata or devmock is required")) {
            return "MAX не передал initData (попробуйте открыть mini app повторно)";
        }
        if (msg.includes("hash is missing")) {
            return "MAX передал неполный initData (нет hash). Попробуйте открыть mini app ещё раз";
        }
        if (msg.includes("auth failed") || msg.includes("dev auth failed")) {
            return "Не удалось авторизовать mini app";
        }
        return error.message || "Ошибка загрузки данных";
    }
    async function refreshReportContext(reportId, uid) {
        const ctx = await getModerationReportContext(reportId, uid);
        setReportDeepLink({ reportId, context: ctx });
    }
    async function reloadComments(currentPostId, includeHidden) {
        const response = await getComments(currentPostId, includeHidden ? { includeHidden: true } : undefined);
        const mapped = response.items.map((c) => ({
            id: c.id,
            text: c.text,
            authorId: c.authorId,
            createdAt: c.createdAt,
            isEdited: Boolean(c.isEdited),
            author: c.author ?? null
        }));
        setComments(mapped);
    }
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        const root = document.documentElement;
        const updateVh = () => {
            const vv = window.visualViewport;
            const h = vv?.height ?? window.innerHeight;
            root.style.setProperty("--app-vh", `${h}px`);
        };
        updateVh();
        window.addEventListener("resize", updateVh);
        window.visualViewport?.addEventListener("resize", updateVh);
        window.visualViewport?.addEventListener("scroll", updateVh);
        return () => {
            window.removeEventListener("resize", updateVh);
            window.visualViewport?.removeEventListener("resize", updateVh);
            window.visualViewport?.removeEventListener("scroll", updateVh);
            root.style.removeProperty("--app-vh");
        };
    }, []);
    useEffect(() => {
        async function init() {
            setLoading(true);
            setBootstrapError(null);
            try {
                const startParam = getStartParam();
                const query = new URLSearchParams(window.location.search);
                const postFromQuery = query.get("postId") ?? import.meta.env.VITE_DEV_POST_ID ?? "";
                const reportIdFromDeepLink = parseReportIdFromStartParam(startParam);
                const resolvedPostId = reportIdFromDeepLink
                    ? ""
                    : (startParam?.replace(/^post_/, "") || postFromQuery || "").trim();
                const useDevMock = import.meta.env.VITE_DEV_MAX_AUTH === "true";
                let auth;
                if (useDevMock) {
                    auth = await authByDevMock({
                        maxUserId: String(import.meta.env.VITE_DEV_MAX_USER_ID ?? "900001"),
                        username: "localdev",
                        chatMaxId: String(import.meta.env.VITE_DEV_CHAT_MAX_ID ?? "-100"),
                        startParam: startParam || (resolvedPostId ? `post_${resolvedPostId}` : undefined)
                    });
                    setSelfDisplayHint("localdev");
                }
                else {
                    const initData = await waitForInitData();
                    console.log("MAX initData diagnostics", {
                        length: initData.length,
                        hasHash: initData.includes("hash="),
                        hasAuthDate: initData.includes("auth_date=")
                    });
                    auth = await authByInitData(initData);
                    setSelfDisplayHint(hintFromInitDataUnsafeUser());
                }
                setUserId(auth.userId);
                setReportDeepLink(null);
                let resolvedRole = "user";
                try {
                    const meRole = await getMeRole(auth.userId);
                    resolvedRole = meRole.role;
                    setRole(meRole.role);
                }
                catch {
                    setRole("user");
                }
                if (reportIdFromDeepLink) {
                    const ctx = await getModerationReportContext(reportIdFromDeepLink, auth.userId);
                    setReportDeepLink({ reportId: reportIdFromDeepLink, context: ctx });
                    setPostId(ctx.postId);
                    const post = await getPost(ctx.postId, auth.userId);
                    setRestriction(post.restriction);
                    await reloadComments(ctx.postId, resolvedRole === "moderator");
                }
                else {
                    const postIdFromAuth = auth.startParam?.replace(/^post_/, "").trim() ?? "";
                    const finalPostId = resolvedPostId || postIdFromAuth;
                    setPostId(finalPostId);
                    if (finalPostId) {
                        const post = await getPost(finalPostId, auth.userId);
                        setRestriction(post.restriction);
                        await reloadComments(finalPostId);
                    }
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
        return (_jsx("div", { className: "comments-app", style: { justifyContent: "center", alignItems: "center" }, children: _jsx("p", { style: { color: "#9b9ba3" }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) }));
    }
    if (bootstrapError) {
        return (_jsxs("main", { className: "comments-app", style: { padding: 16, justifyContent: "center" }, children: [_jsx("h1", { style: { fontSize: "1.1rem" }, children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435" }), _jsx("p", { style: { color: "#9b9ba3" }, children: bootstrapError }), _jsx("button", { type: "button", onClick: () => setBootstrapAttempt((n) => n + 1), children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" })] }));
    }
    async function handleResolveKeepFromReport() {
        if (!reportDeepLink)
            return;
        await resolveModerationReportKeep(reportDeepLink.reportId, userId);
        await refreshReportContext(reportDeepLink.reportId, userId);
        await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
    }
    const reportBanner = reportDeepLink
        ? {
            handled: reportDeepLink.context.reportStatus !== "open",
            deleted: reportDeepLink.context.commentStatus === "deleted",
            noRights: !reportDeepLink.context.canModerate
        }
        : null;
    return (_jsxs("div", { className: "comments-app", children: [_jsxs("header", { className: "comments-app__header", children: [_jsx("h1", { children: "\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435" }), reportBanner ? (_jsxs("div", { className: "report-dl-banner", role: "status", children: [reportBanner.handled ? _jsx("p", { className: "report-dl-banner__line", children: "\u0416\u0430\u043B\u043E\u0431\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430." }) : null, reportBanner.deleted ? _jsx("p", { className: "report-dl-banner__line", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0443\u0434\u0430\u043B\u0451\u043D." }) : null, reportBanner.noRights ? (_jsx("p", { className: "report-dl-banner__line", children: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u0440\u0430\u0432 \u0434\u043B\u044F \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u044D\u0442\u043E\u0433\u043E \u0430\u0432\u0442\u043E\u0440\u0430." })) : null, reportDeepLink &&
                                reportDeepLink.context.canModerate &&
                                reportDeepLink.context.reportsOpenCount > 0 ? (_jsx("button", { type: "button", className: "report-dl-banner__action", onClick: () => void handleResolveKeepFromReport(), children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0436\u0430\u043B\u043E\u0431\u0443 \u0431\u0435\u0437 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F" })) : null] })) : null, _jsx(RestrictionBanner, { restriction: restriction })] }), postId ? (_jsx(CommentList, { comments: comments, currentUserId: userId, selfDisplayHint: selfDisplayHint, postId: postId, highlightCommentId: reportDeepLink?.context.commentId, reportBadge: reportDeepLink && reportDeepLink.context.commentStatus !== "deleted"
                    ? {
                        commentId: reportDeepLink.context.commentId,
                        openCount: reportDeepLink.context.reportsOpenCount,
                        linkedReportClosed: reportDeepLink.context.reportStatus !== "open"
                    }
                    : undefined, reportModMenu: reportDeepLink &&
                    reportDeepLink.context.canModerate &&
                    reportDeepLink.context.reportsOpenCount > 0
                    ? { anchorCommentId: reportDeepLink.context.commentId, onResolveKeep: handleResolveKeepFromReport }
                    : undefined, onReply: (c) => {
                    setReplyToMessage(c);
                    setEditingMessage(null);
                }, onEdit: (c) => {
                    setEditingMessage(c);
                    setReplyToMessage(null);
                }, onDelete: async (commentId) => {
                    await deleteOwnComment(commentId, userId);
                    await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
                }, canModerate: role === "moderator", onModerateDelete: async (commentId) => {
                    if (!window.confirm("Delete comment as moderator?"))
                        return;
                    await moderateCommentByModerator(userId, commentId, "delete");
                    if (reportDeepLink) {
                        await refreshReportContext(reportDeepLink.reportId, userId);
                    }
                    await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
                }, onMuteUser: async (targetUserId) => {
                    if (!window.confirm("Mute this user?"))
                        return;
                    await muteUserByModerator(userId, targetUserId);
                }, onBlockUser: async (targetUserId) => {
                    if (!window.confirm("Block this user?"))
                        return;
                    await blockUserByModerator(userId, targetUserId);
                }, onUnblockUser: async (targetUserId) => {
                    if (!window.confirm("Unblock this user?"))
                        return;
                    await unblockUserByModerator(userId, targetUserId);
                }, onReport: async (c) => {
                    const reason = window.prompt("Причина жалобы (необязательно)") ?? "";
                    try {
                        await reportComment(c.id, userId, reason.trim() || undefined);
                    }
                    catch {
                        window.alert("Не удалось отправить жалобу");
                    }
                } })) : (_jsx("div", { className: "comments-app__scroll", children: _jsxs("div", { className: "chat-empty", children: [_jsx("p", { className: "chat-empty__title", children: COMMENT_NO_POST }), _jsx("p", { className: "chat-empty__subtitle", children: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435 \u0438\u0437 \u043F\u043E\u0441\u0442\u0430 \u0432 MAX." })] }) })), canComment && postId && (_jsx(Composer, { editingMessage: editingMessage, replyToMessage: replyToMessage, onCancelReply: () => setReplyToMessage(null), onSubmit: async (text, files) => {
                    const attachmentIds = [];
                    for (const file of files) {
                        const uploaded = await uploadCommentImage(file);
                        attachmentIds.push(uploaded.id);
                    }
                    if (editingMessage) {
                        await updateOwnComment(editingMessage.id, userId, text);
                        setEditingMessage(null);
                    }
                    else {
                        await createComment(postId, userId, text, attachmentIds);
                        setReplyToMessage(null);
                    }
                    await reloadComments(postId, role === "moderator" && Boolean(reportDeepLink));
                } }))] }));
}
