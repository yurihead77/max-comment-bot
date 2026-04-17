import { useEffect, useState } from "react";
import { getModerationLog } from "../../lib/admin-api";

export function ModlogPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    getModerationLog().then((data) => setItems(data.items ?? []));
  }, []);

  return (
    <section>
      <h2>Moderation log</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.actionType} - {new Date(item.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </section>
  );
}
