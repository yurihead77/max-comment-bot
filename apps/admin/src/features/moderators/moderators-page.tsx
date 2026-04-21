import { useEffect, useState } from "react";
import { assignModerator, getModerators, revokeModerator } from "../../lib/admin-api";

export function ModeratorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState("");

  async function load() {
    const data = await getModerators();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2>Moderators</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await assignModerator(userId.trim());
          setUserId("");
          await load();
        }}
      >
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Admin User ID" />
        <button type="submit">Assign moderator</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.email} ({item.id})
            <button
              onClick={async () => {
                if (!window.confirm("Remove moderator role?")) return;
                await revokeModerator(item.id);
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
