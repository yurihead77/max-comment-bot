import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { LoginPage } from "../features/auth/login-page";
import { CommentsTable } from "../features/comments/comments-table";
import { ModlogPage } from "../features/modlog/modlog-page";
import { RestrictionsPage } from "../features/restrictions/restrictions-page";
export function Router() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [tab, setTab] = useState("comments");
    if (!loggedIn) {
        return _jsx(LoginPage, { onSuccess: () => setLoggedIn(true) });
    }
    return (_jsxs("main", { style: { padding: 16, display: "grid", gap: 12 }, children: [_jsx("h1", { children: "Admin panel" }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { onClick: () => setTab("comments"), children: "Comments" }), _jsx("button", { onClick: () => setTab("restrictions"), children: "Restrictions" }), _jsx("button", { onClick: () => setTab("modlog"), children: "Moderation log" })] }), tab === "comments" && _jsx(CommentsTable, {}), tab === "restrictions" && _jsx(RestrictionsPage, {}), tab === "modlog" && _jsx(ModlogPage, {})] }));
}
