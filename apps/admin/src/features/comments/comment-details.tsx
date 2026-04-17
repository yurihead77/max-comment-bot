interface CommentDetailsProps {
  item: any;
}

export function CommentDetails({ item }: CommentDetailsProps) {
  if (!item) {
    return <p>Select a comment</p>;
  }
  return (
    <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <h3>Comment details</h3>
      <p>ID: {item.id}</p>
      <p>Status: {item.status}</p>
      <p>Author ID: {item.authorId}</p>
      <p>Text: {item.text}</p>
    </section>
  );
}
