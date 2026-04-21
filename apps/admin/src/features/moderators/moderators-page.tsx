import { useEffect, useState } from "react";
import { assignModerator, getModerators, revokeModerator } from "../../lib/admin-api";

export function ModeratorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [platformUserId, setPlatformUserId] = useState("");

  async function load() {
    const data = await getModerators();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="card" style={{ display: "grid", gap: 8 }}>
      <h2>Moderators</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await assignModerator(platformUserId.trim());
          setPlatformUserId("");
          await load();
        }}
      >
        <input
          value={platformUserId}
          onChange={(e) => setPlatformUserId(e.target.value)}
          placeholder="Platform User ID (max_user_id)"
        />
        <button type="submit">Assign moderator</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.userId}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {item.avatarUrl ? <img src={item.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: "50%" }} /> : null}
              {item.displayName || "Unknown"} ({item.platformUserId})
            </span>
            <button
              onClick={async () => {
                if (!window.confirm("Remove moderator role?")) return;
                await revokeModerator(item.platformUserId);
                await load();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
