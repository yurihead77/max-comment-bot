import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { assignModerator, getModerators, revokeModerator } from "../../lib/admin-api";
export function ModeratorsPage() {
    const [items, setItems] = useState([]);
    const [userId, setUserId] = useState("");
    async function load() {
        const data = await getModerators();
        setItems(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { style: { display: "grid", gap: 8 }, children: [_jsx("h2", { children: "Moderators" }), _jsxs("form", { onSubmit: async (event) => {
                    event.preventDefault();
                    await assignModerator(userId.trim());
                    setUserId("");
                    await load();
                }, children: [_jsx("input", { value: userId, onChange: (e) => setUserId(e.target.value), placeholder: "Admin User ID" }), _jsx("button", { type: "submit", children: "Assign moderator" })] }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.email, " (", item.id, ")", _jsx("button", { onClick: async () => {
                                if (!window.confirm("Remove moderator role?"))
                                    return;
                                await revokeModerator(item.id);
                                await load();
                            }, children: "Remove" })] }, item.id))) })] }));
}
