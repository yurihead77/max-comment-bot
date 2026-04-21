import { useEffect, useState } from "react";
import { createRestriction, getRestrictions, revokeRestriction } from "../../lib/admin-api";

export function RestrictionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [restrictionType, setRestrictionType] = useState<"mute" | "block">("mute");

  async function load() {
    const data = await getRestrictions();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="card" style={{ display: "grid", gap: 8 }}>
      <h2>Global restrictions</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await createRestriction({ userId, type: restrictionType, reason });
          await load();
        }}
      >
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <select
          value={restrictionType}
          onChange={(e) => setRestrictionType(e.target.value as "mute" | "block")}
        >
          <option value="mute">mute</option>
          <option value="block">block</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <button type="submit">Add restriction</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.userId} ({item.user?.maxUserId || "no maxUserId"}) - {item.type} - {item.active ? "active" : "inactive"} - by{" "}
            {item.createdBy} at{" "}
            {new Date(item.createdAt).toLocaleString()}
            {item.active ? (
              <button
                onClick={async () => {
                  if (!window.confirm("Revoke restriction?")) return;
                  await revokeRestriction(item.id);
                  await load();
                }}
              >
                {item.type === "mute" ? "Unmute" : "Unblock"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
