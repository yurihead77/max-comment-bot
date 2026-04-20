import { useEffect, useRef, useState } from "react";
import type { CommentItemModel } from "./comment-item";

export interface CommentInputProps {
  onSubmit: (text: string, files: File[]) => Promise<void>;
  initialText?: string;
  submitLabel?: string;
  replyTo: CommentItemModel | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function CommentInput({
  onSubmit,
  initialText = "",
  submitLabel = "Отправить",
  replyTo,
  onCancelReply,
  disabled = false
}: CommentInputProps) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const busy = loading || disabled;

  return (
    <form
      ref={formRef}
      className="comment-input-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setLoading(true);
        try {
          await onSubmit(text, []);
          setText("");
          if (replyTo) onCancelReply();
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="comment-input-form__row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy && text.trim()) formRef.current?.requestSubmit();
            }
          }}
          rows={2}
          placeholder={replyTo ? "Ваш ответ…" : "Сообщение…"}
          aria-label="Текст комментария"
        />
        <button type="submit" className="comment-input-form__send" disabled={busy || !text.trim()}>
          {loading ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
