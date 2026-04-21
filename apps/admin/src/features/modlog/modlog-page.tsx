import { useEffect, useState } from "react";
import { getModerationLog } from "../../lib/admin-api";

export function ModlogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });

  useEffect(() => {
    getModerationLog({ page }).then((data) => {
      setItems(data.items ?? []);
      setPagination(data.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 });
    });
  }, [page]);

  return (
    <section>
      <h2>Moderation log</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.actionType} - by {item.performedByUserId} - {new Date(item.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
          Prev
        </button>
        <span>
          Page {pagination.page} / {pagination.totalPages}
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setPage((value) => Math.min(value + 1, pagination.totalPages))}
        >
          Next
        </button>
      </div>
    </section>
  );
}
