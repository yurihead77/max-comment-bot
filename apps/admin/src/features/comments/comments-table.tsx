import { useEffect, useState } from "react";
import { getAdminComments, moderateComment } from "../../lib/admin-api";
import { CommentDetails } from "./comment-details";

export function CommentsTable() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  async function load() {
    const data = await getAdminComments();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2>Comments moderation</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <button onClick={() => setSelected(item)}>{item.id}</button>
              </td>
              <td>{item.status}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button onClick={async () => { await moderateComment(item.id, "hide"); await load(); }}>Hide</button>
                <button onClick={async () => { await moderateComment(item.id, "delete"); await load(); }}>Delete</button>
                <button onClick={async () => { await moderateComment(item.id, "restore"); await load(); }}>Restore</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CommentDetails item={selected} />
    </section>
  );
}
