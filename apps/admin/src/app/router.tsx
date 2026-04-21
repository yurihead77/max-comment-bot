import { useState } from "react";
import { LoginPage } from "../features/auth/login-page";
import { CommentsTable } from "../features/comments/comments-table";
import { ModlogPage } from "../features/modlog/modlog-page";
import { ModeratorsPage } from "../features/moderators/moderators-page";
import { RestrictionsPage } from "../features/restrictions/restrictions-page";

export function Router() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<"comments" | "moderators" | "restrictions" | "modlog">("comments");

  if (!loggedIn) {
    return <LoginPage onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <main className="admin-shell">
      <h1 className="admin-title">Admin panel</h1>
      <div className="admin-tabs">
        <button onClick={() => setTab("comments")}>Comments</button>
        <button onClick={() => setTab("moderators")}>Moderators</button>
        <button onClick={() => setTab("restrictions")}>Restrictions</button>
        <button onClick={() => setTab("modlog")}>Moderation log</button>
      </div>
      {tab === "comments" && <CommentsTable />}
      {tab === "moderators" && <ModeratorsPage />}
      {tab === "restrictions" && <RestrictionsPage />}
      {tab === "modlog" && <ModlogPage />}
    </main>
  );
}
