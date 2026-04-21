import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getAdminCommentDetails, getAdminComments, getChannels, moderateComment } from "../../lib/admin-api";
import { CommentDetails } from "./comment-details";
export function CommentsTable() {
    const [items, setItems] = useState([]);
    const [channels, setChannels] = useState([]);
    const [selected, setSelected] = useState(null);
    const [selectedDetails, setSelectedDetails] = useState(null);
    const [filters, setFilters] = useState({
        status: "",
        channelId: "",
        text: "",
        authorUserId: "",
        reportedOnly: false
    });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
    async function load() {
        const data = await getAdminComments({
            status: (filters.status || undefined),
            channelId: filters.channelId || undefined,
            text: filters.text || undefined,
            authorUserId: filters.authorUserId || undefined,
            reportedOnly: filters.reportedOnly ? "true" : undefined,
            page
        });
        setItems(data.items ?? []);
        setPagination(data.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    }
    async function loadChannels() {
        const data = await getChannels();
        setChannels(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, [page]);
    useEffect(() => {
        void loadChannels();
    }, []);
    return (_jsxs("section", { className: "card", style: { display: "grid", gap: 10 }, children: [_jsx("h2", { children: "Comments moderation" }), _jsxs("form", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, onSubmit: async (event) => {
                    event.preventDefault();
                    setPage(1);
                    await load();
                }, children: [_jsxs("select", { value: filters.channelId, onChange: (e) => setFilters({ ...filters, channelId: e.target.value }), children: [_jsx("option", { value: "", children: "All channels" }), channels.map((channel) => (_jsx("option", { value: channel.maxChatId, children: channel.title || channel.maxChatId }, channel.id)))] }), _jsxs("select", { value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "active", children: "active" }), _jsx("option", { value: "hidden", children: "hidden" }), _jsx("option", { value: "deleted", children: "deleted" })] }), _jsx("input", { value: filters.text, onChange: (e) => setFilters({ ...filters, text: e.target.value }), placeholder: "Search text" }), _jsx("input", { value: filters.authorUserId, onChange: (e) => setFilters({ ...filters, authorUserId: e.target.value }), placeholder: "Author UserID" }), _jsxs("label", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: filters.reportedOnly, onChange: (e) => setFilters({ ...filters, reportedOnly: e.target.checked }) }), "Reported only"] }), _jsx("button", { type: "submit", children: "Apply filters" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Comment" }), _jsx("th", { children: "Reports" }), _jsx("th", { children: "Author" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Channel/Post" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: items.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("button", { onClick: async () => {
                                            setSelected(item);
                                            const details = await getAdminCommentDetails(item.id);
                                            setSelectedDetails(details);
                                        }, children: item.text?.slice(0, 80) || item.id }) }), _jsx("td", { children: item.isReported ? (_jsx("span", { title: `Open reports: ${item.openReportCount ?? 0}`, children: _jsxs("span", { style: {
                                                display: "inline-block",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                background: "#fde8e8",
                                                color: "#a40000",
                                                fontSize: 12,
                                                fontWeight: 600
                                            }, children: ["Reported (", item.openReportCount ?? 0, ")"] }) })) : (_jsx("span", { className: "muted", children: "\u2014" })) }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [item.author?.photoUrl ? (_jsx("img", { src: item.author.photoUrl, alt: "", width: 24, height: 24, style: { borderRadius: "50%" } })) : null, _jsxs("span", { children: [item.author?.firstName || item.author?.username || "Unknown", " (", item.author?.maxUserId || item.authorId, ")"] })] }) }), _jsx("td", { children: item.status }), _jsxs("td", { children: [item.post?.chat?.title || item.post?.chat?.maxChatId, " / ", item.postId] }), _jsxs("td", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { onClick: async () => {
                                                if (!window.confirm("Hide comment?"))
                                                    return;
                                                await moderateComment(item.id, "hide");
                                                await load();
                                            }, children: "Hide" }), _jsx("button", { onClick: async () => {
                                                if (!window.confirm("Delete comment?"))
                                                    return;
                                                await moderateComment(item.id, "delete");
                                                await load();
                                            }, children: "Delete" }), _jsx("button", { onClick: async () => {
                                                if (!window.confirm("Restore comment?"))
                                                    return;
                                                await moderateComment(item.id, "restore");
                                                await load();
                                            }, children: "Restore" })] })] }, item.id))) })] }), _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("button", { disabled: pagination.page <= 1, onClick: () => setPage((value) => Math.max(value - 1, 1)), children: "Prev" }), _jsxs("span", { children: ["Page ", pagination.page, " / ", pagination.totalPages, " (", pagination.total, ")"] }), _jsx("button", { disabled: pagination.page >= pagination.totalPages, onClick: () => setPage((value) => Math.min(value + 1, pagination.totalPages)), children: "Next" })] }), _jsx(CommentDetails, { item: selectedDetails || selected })] }));
}
