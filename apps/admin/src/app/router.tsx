import { useState } from "react";
import { LoginPage } from "../features/auth/login-page";
import { CommentsTable } from "../features/comments/comments-table";
import { ModlogPage } from "../features/modlog/modlog-page";
import { RestrictionsPage } from "../features/restrictions/restrictions-page";

export function Router() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<"comments" | "restrictions" | "modlog">("comments");

  if (!loggedIn) {
    return <LoginPage onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1>Admin panel</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("comments")}>Comments</button>
        <button onClick={() => setTab("restrictions")}>Restrictions</button>
        <button onClick={() => setTab("modlog")}>Moderation log</button>
      </div>
      {tab === "comments" && <CommentsTable />}
      {tab === "restrictions" && <RestrictionsPage />}
      {tab === "modlog" && <ModlogPage />}
    </main>
  );
}
