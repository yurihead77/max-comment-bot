import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getAdminComments, moderateComment } from "../../lib/admin-api";
import { CommentDetails } from "./comment-details";
export function CommentsTable() {
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    async function load() {
        const data = await getAdminComments();
        setItems(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { style: { display: "grid", gap: 8 }, children: [_jsx("h2", { children: "Comments moderation" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "ID" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: items.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("button", { onClick: () => setSelected(item), children: item.id }) }), _jsx("td", { children: item.status }), _jsxs("td", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { onClick: async () => { await moderateComment(item.id, "hide"); await load(); }, children: "Hide" }), _jsx("button", { onClick: async () => { await moderateComment(item.id, "delete"); await load(); }, children: "Delete" }), _jsx("button", { onClick: async () => { await moderateComment(item.id, "restore"); await load(); }, children: "Restore" })] })] }, item.id))) })] }), _jsx(CommentDetails, { item: selected })] }));
}
