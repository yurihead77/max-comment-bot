import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getModerationLog } from "../../lib/admin-api";
export function ModlogPage() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
    useEffect(() => {
        getModerationLog({ page }).then((data) => {
            setItems(data.items ?? []);
            setPagination(data.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 });
        });
    }, [page]);
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Moderation log" }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.actionType, " - by ", item.performedByUserId, item.metadataJson?.platformUserId ? ` (MAX: ${item.metadataJson.platformUserId})` : "", " -", " ", new Date(item.createdAt).toLocaleString()] }, item.id))) }), _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("button", { disabled: pagination.page <= 1, onClick: () => setPage((value) => Math.max(value - 1, 1)), children: "Prev" }), _jsxs("span", { children: ["Page ", pagination.page, " / ", pagination.totalPages] }), _jsx("button", { disabled: pagination.page >= pagination.totalPages, onClick: () => setPage((value) => Math.min(value + 1, pagination.totalPages)), children: "Next" })] })] }));
}
