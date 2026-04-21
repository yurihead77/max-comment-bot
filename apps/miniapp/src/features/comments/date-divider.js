import { jsx as _jsx } from "react/jsx-runtime";
export function DateDivider({ label }) {
    return (_jsx("div", { className: "chat-date-divider", "aria-label": label, children: _jsx("span", { className: "chat-date-divider__pill", children: label }) }));
}
export function formatDateDividerLabel(iso) {
    const now = new Date();
    const d = new Date(iso);
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((startOf(now).getTime() - startOf(d).getTime()) / dayMs);
    if (diffDays === 0)
        return "Сегодня";
    if (diffDays === 1)
        return "Вчера";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
