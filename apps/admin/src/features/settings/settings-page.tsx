import { useEffect, useState } from "react";
import { getAdminSettings, patchAdminSettings } from "../../lib/admin-api";

export function SettingsPage() {
  const [moderationChatId, setModerationChatId] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await getAdminSettings();
      setModerationChatId(data.moderationChatId ?? "");
      setSaved(data.moderationChatId ?? null);
    } catch {
      setError("Failed to load settings");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="card" style={{ display: "grid", gap: 12 }}>
      <h2>Bot settings</h2>
      <p className="muted" style={{ margin: 0 }}>
        Moderation Chat ID: MAX platform chat id used only for moderator notifications. Messages there are plain text — no
        discussion/open_app buttons and no post registration.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Current:</strong> {saved === null || saved === "" ? "(not set)" : saved}
      </p>
      {error ? <p style={{ color: "#c00" }}>{error}</p> : null}
      <form
        style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const next = moderationChatId.trim() === "" ? null : moderationChatId.trim();
            const data = await patchAdminSettings({ moderationChatId: next });
            setSaved(data.moderationChatId ?? null);
            setModerationChatId(data.moderationChatId ?? "");
          } catch {
            setError("Save failed");
          }
        }}
      >
        <label>
          Moderation Chat ID (MAX)
          <input
            style={{ width: "100%", marginTop: 4 }}
            value={moderationChatId}
            onChange={(ev) => setModerationChatId(ev.target.value)}
            placeholder="e.g. -1001234567890"
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit">Save</button>
          <button
            type="button"
            onClick={async () => {
              setModerationChatId("");
              setError(null);
              try {
                const data = await patchAdminSettings({ moderationChatId: null });
                setSaved(data.moderationChatId ?? null);
              } catch {
                setError("Clear failed");
              }
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </section>
  );
}
