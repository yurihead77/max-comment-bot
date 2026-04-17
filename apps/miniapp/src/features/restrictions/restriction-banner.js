import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function RestrictionBanner({ restriction }) {
    if (!restriction) {
        return null;
    }
    return (_jsx("div", { style: { padding: 12, background: "#fef3c7", borderRadius: 8 }, children: restriction.type === "temporary_mute" ? (_jsxs("p", { children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0434\u043E ", restriction.endsAt ?? "неизвестной даты", "."] })) : (_jsx("p", { children: "\u0412\u044B \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0434\u043B\u044F \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0438 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432." })) }));
}
