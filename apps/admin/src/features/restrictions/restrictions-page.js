import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createRestriction, getRestrictions } from "../../lib/admin-api";
export function RestrictionsPage() {
    const [items, setItems] = useState([]);
    const [userId, setUserId] = useState("");
    const [reason, setReason] = useState("");
    const [restrictionType, setRestrictionType] = useState("temporary_mute");
    async function load() {
        const data = await getRestrictions();
        setItems(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { style: { display: "grid", gap: 8 }, children: [_jsx("h2", { children: "Global restrictions" }), _jsxs("form", { onSubmit: async (event) => {
                    event.preventDefault();
                    await createRestriction({ userId, restrictionType, reason });
                    await load();
                }, children: [_jsx("input", { value: userId, onChange: (e) => setUserId(e.target.value), placeholder: "User ID" }), _jsxs("select", { value: restrictionType, onChange: (e) => setRestrictionType(e.target.value), children: [_jsx("option", { value: "temporary_mute", children: "temporary_mute" }), _jsx("option", { value: "permanent_block", children: "permanent_block" })] }), _jsx("input", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Reason" }), _jsx("button", { type: "submit", children: "Add restriction" })] }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.userId, " - ", item.restrictionType, " - ", item.isActive ? "active" : "inactive"] }, item.id))) })] }));
}
