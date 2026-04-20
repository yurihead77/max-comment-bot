import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
if (!window.WebApp) {
    console.warn("MAX WebApp SDK not available");
}
const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
createRoot(rootElement).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
