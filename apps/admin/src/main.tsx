import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "./app/router";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
