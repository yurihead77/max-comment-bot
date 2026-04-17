import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "./app/router";
const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
createRoot(rootElement).render(_jsx(React.StrictMode, { children: _jsx(Router, {}) }));
