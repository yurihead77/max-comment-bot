import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getModerationLog } from "../../lib/admin-api";
export function ModlogPage() {
    const [items, setItems] = useState([]);
    useEffect(() => {
        getModerationLog().then((data) => setItems(data.items ?? []));
    }, []);
    return (_jsxs("section", { children: [_jsx("h2", { children: "Moderation log" }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.actionType, " - ", new Date(item.createdAt).toLocaleString()] }, item.id))) })] }));
}
