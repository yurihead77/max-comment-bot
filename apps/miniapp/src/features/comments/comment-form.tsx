import { useState } from "react";

interface CommentFormProps {
  onSubmit: (text: string, files: File[]) => Promise<void>;
  initialText?: string;
  submitLabel?: string;
}

export function CommentForm({ onSubmit, initialText = "", submitLabel = "Send" }: CommentFormProps) {
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
          await onSubmit(text, files);
          setText("");
          setFiles([]);
        } finally {
          setLoading(false);
        }
      }}
      style={{ display: "grid", gap: 8 }}
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
      />
      <button type="submit" disabled={loading || !text.trim()}>
        {loading ? "Loading..." : submitLabel}
      </button>
    </form>
  );
}
