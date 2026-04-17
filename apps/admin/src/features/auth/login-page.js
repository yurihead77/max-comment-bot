import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { adminLogin } from "../../lib/admin-api";
export function LoginPage({ onSuccess }) {
    const [email, setEmail] = useState("admin@example.com");
    const [password, setPassword] = useState("ChangeMe123!");
    const [error, setError] = useState("");
    return (_jsxs("form", { onSubmit: async (event) => {
            event.preventDefault();
            setError("");
            try {
                await adminLogin(email, password);
                onSuccess();
            }
            catch {
                setError("Invalid credentials");
            }
        }, style: { display: "grid", gap: 8, maxWidth: 360 }, children: [_jsx("h1", { children: "Admin login" }), _jsx("input", { value: email, onChange: (e) => setEmail(e.target.value), placeholder: "Email" }), _jsx("input", { value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Password", type: "password" }), _jsx("button", { type: "submit", children: "Login" }), error ? _jsx("p", { children: error }) : null] }));
}
