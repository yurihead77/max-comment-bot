import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ReactionBar({ state, onToggleReaction }) {
    const entries = Object.entries(state?.counts ?? {}).filter(([, count]) => count > 0);
    if (entries.length === 0)
        return null;
    return (_jsx("div", { className: "chat-reactions", "aria-label": "\u0420\u0435\u0430\u043A\u0446\u0438\u0438", children: entries.map(([emoji, count]) => {
            const active = state?.pick === emoji;
            return (_jsxs("button", { type: "button", className: "chat-reactions__item" + (active ? " chat-reactions__item--active" : ""), onClick: (e) => {
                    e.stopPropagation();
                    onToggleReaction(emoji);
                }, children: [_jsx("span", { className: "chat-reactions__emoji", children: emoji }), _jsx("span", { className: "chat-reactions__count", children: count })] }, emoji));
        }) }));
}
