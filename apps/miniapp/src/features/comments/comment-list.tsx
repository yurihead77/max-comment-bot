import { useEffect, useRef, useState } from "react";
import { CommentContextMenu } from "./comment-context-menu";
import { CommentItem, type CommentItemModel } from "./comment-item";

interface CommentListProps {
  comments: CommentItemModel[];
  currentUserId: string;
  postId: string;
  onEdit: (comment: CommentItemModel) => void;
  onDelete: (commentId: string) => void | Promise<void>;
  onReply: (comment: CommentItemModel) => void;
}

export function CommentList({ comments, currentUserId, postId, onEdit, onDelete, onReply }: CommentListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ comment: CommentItemModel; x: number; y: number } | null>(null);
  const [reactions, setReactions] = useState<
    Record<string, { counts: Record<string, number>; pick?: string }>
  >({});

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments.length, comments[comments.length - 1]?.id]);

  const toggleReaction = (commentId: string, emoji: string) => {
    setReactions((prev) => {
      const curEntry = prev[commentId] ?? { counts: {} };
      const counts = { ...curEntry.counts };
      const prevPick = curEntry.pick;
      let pick = prevPick;
      if (prevPick === emoji) {
        pick = undefined;
        counts[emoji] = Math.max(0, (counts[emoji] ?? 1) - 1);
      } else {
        if (prevPick && counts[prevPick]) counts[prevPick] = Math.max(0, counts[prevPick]! - 1);
        pick = emoji;
        counts[emoji] = (counts[emoji] ?? 0) + 1;
      }
      return { ...prev, [commentId]: { counts, pick } };
    });
  };

  return (
    <>
      <div className="comments-app__scroll" ref={scrollRef}>
        <ul className="chat-list">
          {comments.map((comment, index) => {
            const prev = comments[index - 1];
            const grouped = Boolean(prev && prev.authorId === comment.authorId);
            const showAvatar = !grouped;
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                showAvatar={showAvatar}
                groupedWithPrevious={grouped}
                onOpenMenu={(c, anchor) => setMenu({ comment: c, x: anchor.x, y: anchor.y })}
                reactionCounts={reactions[comment.id]?.counts ?? {}}
                userReaction={reactions[comment.id]?.pick}
                onToggleReaction={(emoji) => toggleReaction(comment.id, emoji)}
              />
            );
          })}
        </ul>
      </div>
      <CommentContextMenu
        comment={menu?.comment ?? null}
        anchor={menu ? { x: menu.x, y: menu.y } : null}
        currentUserId={currentUserId}
        postId={postId}
        onClose={() => setMenu(null)}
        onReply={(c) => {
          onReply(c);
          setMenu(null);
        }}
        onEdit={(c) => {
          onEdit(c);
          setMenu(null);
        }}
        onDelete={(id) => void onDelete(id)}
      />
    </>
  );
}
