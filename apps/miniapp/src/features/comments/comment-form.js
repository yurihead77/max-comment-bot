import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function CommentForm({ onSubmit, initialText = "", submitLabel = "Send" }) {
    const [text, setText] = useState(initialText);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    return (_jsxs("form", { onSubmit: async (event) => {
            event.preventDefault();
            setLoading(true);
            try {
                await onSubmit(text, files);
                setText("");
                setFiles([]);
            }
            finally {
                setLoading(false);
            }
        }, style: { display: "grid", gap: 8 }, children: [_jsx("textarea", { value: text, onChange: (e) => setText(e.target.value), rows: 4 }), _jsx("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true, onChange: (event) => setFiles(Array.from(event.target.files ?? [])) }), _jsx("button", { type: "submit", disabled: loading || !text.trim(), children: loading ? "Loading..." : submitLabel })] }));
}
