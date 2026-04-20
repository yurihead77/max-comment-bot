import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export function CommentInput({ onSubmit, initialText = "", submitLabel = "Отправить", replyTo, onCancelReply, disabled = false }) {
    const [text, setText] = useState(initialText);
    const [loading, setLoading] = useState(false);
    const formRef = useRef(null);
    useEffect(() => {
        setText(initialText);
    }, [initialText]);
    const busy = loading || disabled;
    return (_jsx("form", { ref: formRef, className: "comment-input-form", onSubmit: async (event) => {
            event.preventDefault();
            if (!text.trim() || busy)
                return;
            setLoading(true);
            try {
                await onSubmit(text, []);
                setText("");
                if (replyTo)
                    onCancelReply();
            }
            finally {
                setLoading(false);
            }
        }, children: _jsxs("div", { className: "comment-input-form__row", children: [_jsx("textarea", { value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!busy && text.trim())
                                formRef.current?.requestSubmit();
                        }
                    }, rows: 2, placeholder: replyTo ? "Ваш ответ…" : "Сообщение…", "aria-label": "\u0422\u0435\u043A\u0441\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F" }), _jsx("button", { type: "submit", className: "comment-input-form__send", disabled: busy || !text.trim(), children: loading ? "…" : submitLabel })] }) }));
}
