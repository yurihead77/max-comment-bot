interface CommentDetailsProps {
  item: any;
}

export function CommentDetails({ item }: CommentDetailsProps) {
  if (!item) {
    return <p>Select a comment</p>;
  }
  return (
    <section className="card">
      <h3>Comment details</h3>
      <p>ID: {item.id}</p>
      <p>Status: {item.status}</p>
      <p>Author ID: {item.authorId}</p>
      <p>Author MAX User ID: {item.author?.maxUserId || "-"}</p>
      <p>Text: {item.text}</p>
      <p>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</p>
      <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</p>
      <p>Post: {item.postId}</p>
      <p>Channel: {item.post?.chat?.title || item.post?.chat?.maxChatId || "-"}</p>
    </section>
  );
}
