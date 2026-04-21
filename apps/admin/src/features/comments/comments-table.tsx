import { useEffect, useState } from "react";
import { getAdminCommentDetails, getAdminComments, getChannels, moderateComment } from "../../lib/admin-api";
import { CommentDetails } from "./comment-details";

export function CommentsTable() {
  const [items, setItems] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: "",
    channelId: "",
    text: "",
    authorUserId: ""
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

  async function load() {
    const data = await getAdminComments({
      status: (filters.status || undefined) as "active" | "hidden" | "deleted" | undefined,
      channelId: filters.channelId || undefined,
      text: filters.text || undefined,
      authorUserId: filters.authorUserId || undefined,
      page
    });
    setItems(data.items ?? []);
    setPagination(data.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
  }

  async function loadChannels() {
    const data = await getChannels();
    setChannels(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, [page]);

  useEffect(() => {
    void loadChannels();
  }, []);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2>Comments moderation</h2>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={async (event) => {
          event.preventDefault();
          setPage(1);
          await load();
        }}
      >
        <select value={filters.channelId} onChange={(e) => setFilters({ ...filters, channelId: e.target.value })}>
          <option value="">All channels</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.maxChatId}>
              {channel.title || channel.maxChatId}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="hidden">hidden</option>
          <option value="deleted">deleted</option>
        </select>
        <input
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
          placeholder="Search text"
        />
        <input
          value={filters.authorUserId}
          onChange={(e) => setFilters({ ...filters, authorUserId: e.target.value })}
          placeholder="Author UserID"
        />
        <button type="submit">Apply filters</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Comment</th>
            <th>Author</th>
            <th>Status</th>
            <th>Channel/Post</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <button
                  onClick={async () => {
                    setSelected(item);
                    const details = await getAdminCommentDetails(item.id);
                    setSelectedDetails(details);
                  }}
                >
                  {item.text?.slice(0, 80) || item.id}
                </button>
              </td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {item.author?.photoUrl ? (
                    <img src={item.author.photoUrl} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />
                  ) : null}
                  <span>
                    {item.author?.firstName || item.author?.username || "Unknown"} ({item.author?.maxUserId || item.authorId})
                  </span>
                </div>
              </td>
              <td>{item.status}</td>
              <td>
                {item.post?.chat?.title || item.post?.chat?.maxChatId} / {item.postId}
              </td>
              <td style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    if (!window.confirm("Hide comment?")) return;
                    await moderateComment(item.id, "hide");
                    await load();
                  }}
                >
                  Hide
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm("Delete comment?")) return;
                    await moderateComment(item.id, "delete");
                    await load();
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm("Restore comment?")) return;
                    await moderateComment(item.id, "restore");
                    await load();
                  }}
                >
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
          Prev
        </button>
        <span>
          Page {pagination.page} / {pagination.totalPages} ({pagination.total})
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setPage((value) => Math.min(value + 1, pagination.totalPages))}
        >
          Next
        </button>
      </div>
      <CommentDetails item={selectedDetails || selected} />
    </section>
  );
}
