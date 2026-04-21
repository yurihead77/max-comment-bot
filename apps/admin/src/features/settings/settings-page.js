import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getAdminSettings, patchAdminSettings } from "../../lib/admin-api";
export function SettingsPage() {
    const [moderationChatId, setModerationChatId] = useState("");
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);
    async function load() {
        setError(null);
        try {
            const data = await getAdminSettings();
            setModerationChatId(data.moderationChatId ?? "");
            setSaved(data.moderationChatId ?? null);
        }
        catch {
            setError("Failed to load settings");
        }
    }
    useEffect(() => {
        void load();
    }, []);
    return (_jsxs("section", { className: "card", style: { display: "grid", gap: 12 }, children: [_jsx("h2", { children: "Bot settings" }), _jsx("p", { className: "muted", style: { margin: 0 }, children: "Moderation Chat ID: MAX platform chat id used only for moderator notifications. Messages there are plain text \u2014 no discussion/open_app buttons and no post registration." }), _jsxs("p", { style: { margin: 0 }, children: [_jsx("strong", { children: "Current:" }), " ", saved === null || saved === "" ? "(not set)" : saved] }), error ? _jsx("p", { style: { color: "#c00" }, children: error }) : null, _jsxs("form", { style: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }, onSubmit: async (e) => {
                    e.preventDefault();
                    setError(null);
                    try {
                        const next = moderationChatId.trim() === "" ? null : moderationChatId.trim();
                        const data = await patchAdminSettings({ moderationChatId: next });
                        setSaved(data.moderationChatId ?? null);
                        setModerationChatId(data.moderationChatId ?? "");
                    }
                    catch {
                        setError("Save failed");
                    }
                }, children: [_jsxs("label", { children: ["Moderation Chat ID (MAX)", _jsx("input", { style: { width: "100%", marginTop: 4 }, value: moderationChatId, onChange: (ev) => setModerationChatId(ev.target.value), placeholder: "e.g. -1001234567890" })] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "submit", children: "Save" }), _jsx("button", { type: "button", onClick: async () => {
                                    setModerationChatId("");
                                    setError(null);
                                    try {
                                        const data = await patchAdminSettings({ moderationChatId: null });
                                        setSaved(data.moderationChatId ?? null);
                                    }
                                    catch {
                                        setError("Clear failed");
                                    }
                                }, children: "Clear" })] })] })] }));
}
