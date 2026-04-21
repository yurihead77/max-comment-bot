import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { assignModerator, getModerators, revokeModerator } from "../../lib/admin-api";
export function ModeratorsPage() {
    const [items, setItems] = useState([]);
    const [platformUserId, setPlatformUserId] = useState("");
    async function load() {
        const data = await getModerators();
        setItems(data.items ?? []);
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { className: "card", style: { display: "grid", gap: 8 }, children: [_jsx("h2", { children: "Moderators" }), _jsxs("form", { onSubmit: async (event) => {
                    event.preventDefault();
                    await assignModerator(platformUserId.trim());
                    setPlatformUserId("");
                    await load();
                }, children: [_jsx("input", { value: platformUserId, onChange: (e) => setPlatformUserId(e.target.value), placeholder: "Platform User ID (max_user_id)" }), _jsx("button", { type: "submit", children: "Assign moderator" })] }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [_jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [item.avatarUrl ? _jsx("img", { src: item.avatarUrl, alt: "", width: 20, height: 20, style: { borderRadius: "50%" } }) : null, item.displayName || "Unknown", " (", item.platformUserId, ")"] }), _jsx("button", { onClick: async () => {
                                if (!window.confirm("Remove moderator role?"))
                                    return;
                                await revokeModerator(item.platformUserId);
                                await load();
                            }, children: "Remove" })] }, item.userId))) })] }));
}
