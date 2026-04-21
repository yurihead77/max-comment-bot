import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { LoginPage } from "../features/auth/login-page";
import { CommentsTable } from "../features/comments/comments-table";
import { ModlogPage } from "../features/modlog/modlog-page";
import { ModeratorsPage } from "../features/moderators/moderators-page";
import { RestrictionsPage } from "../features/restrictions/restrictions-page";
import { SettingsPage } from "../features/settings/settings-page";
export function Router() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [tab, setTab] = useState("comments");
    if (!loggedIn) {
        return _jsx(LoginPage, { onSuccess: () => setLoggedIn(true) });
    }
    return (_jsxs("main", { className: "admin-shell", children: [_jsx("h1", { className: "admin-title", children: "Admin panel" }), _jsxs("div", { className: "admin-tabs", children: [_jsx("button", { onClick: () => setTab("comments"), children: "Comments" }), _jsx("button", { onClick: () => setTab("moderators"), children: "Moderators" }), _jsx("button", { onClick: () => setTab("restrictions"), children: "Restrictions" }), _jsx("button", { onClick: () => setTab("modlog"), children: "Moderation log" }), _jsx("button", { onClick: () => setTab("settings"), children: "Settings" })] }), tab === "comments" && _jsx(CommentsTable, {}), tab === "moderators" && _jsx(ModeratorsPage, {}), tab === "restrictions" && _jsx(RestrictionsPage, {}), tab === "modlog" && _jsx(ModlogPage, {}), tab === "settings" && _jsx(SettingsPage, {})] }));
}
