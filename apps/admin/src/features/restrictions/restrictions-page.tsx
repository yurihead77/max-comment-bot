import { useEffect, useState } from "react";
import { createRestriction, getRestrictions } from "../../lib/admin-api";

export function RestrictionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [restrictionType, setRestrictionType] = useState<"temporary_mute" | "permanent_block">(
    "temporary_mute"
  );

  async function load() {
    const data = await getRestrictions();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2>Global restrictions</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await createRestriction({ userId, restrictionType, reason });
          await load();
        }}
      >
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <select
          value={restrictionType}
          onChange={(e) => setRestrictionType(e.target.value as "temporary_mute" | "permanent_block")}
        >
          <option value="temporary_mute">temporary_mute</option>
          <option value="permanent_block">permanent_block</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <button type="submit">Add restriction</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.userId} - {item.restrictionType} - {item.isActive ? "active" : "inactive"}
          </li>
        ))}
      </ul>
    </section>
  );
}
