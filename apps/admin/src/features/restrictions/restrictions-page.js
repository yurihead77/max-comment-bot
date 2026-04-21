import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createRestriction, getRestrictions, revokeRestriction } from "../../lib/admin-api";
export function RestrictionsPage() {
    const [items, setItems] = useState([]);
    const [userId, setUserId] = useState("");
    const [reason, setReason] = useState("");
    const [restrictionType, setRestrictionType] = useState("mute");
    async function load() {
        const data = await getRestrictions();
        setItems(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { className: "card", style: { display: "grid", gap: 8 }, children: [_jsx("h2", { children: "Global restrictions" }), _jsxs("form", { onSubmit: async (event) => {
                    event.preventDefault();
                    await createRestriction({ userId, type: restrictionType, reason });
                    await load();
                }, children: [_jsx("input", { value: userId, onChange: (e) => setUserId(e.target.value), placeholder: "User ID" }), _jsxs("select", { value: restrictionType, onChange: (e) => setRestrictionType(e.target.value), children: [_jsx("option", { value: "mute", children: "mute" }), _jsx("option", { value: "block", children: "block" })] }), _jsx("input", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Reason" }), _jsx("button", { type: "submit", children: "Add restriction" })] }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.userId, " (", item.user?.maxUserId || "no maxUserId", ") - ", item.type, " - ", item.active ? "active" : "inactive", " - by", " ", item.createdBy, " at", " ", new Date(item.createdAt).toLocaleString(), item.active ? (_jsx("button", { onClick: async () => {
                                if (!window.confirm("Revoke restriction?"))
                                    return;
                                await revokeRestriction(item.id);
                                await load();
                            }, children: item.type === "mute" ? "Unmute" : "Unblock" })) : null] }, item.id))) })] }));
}
