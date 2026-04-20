import { useEffect, useRef, useState } from "react";
import { CommentContextMenu } from "./comment-context-menu";
import { CommentItem, type CommentItemModel } from "./comment-item";
import { COMMENT_EMPTY_SUBTITLE, COMMENT_EMPTY_TITLE } from "./comment-ui-strings";

interface CommentListProps {
  comments: CommentItemModel[];
  currentUserId: string;
  selfDisplayHint?: string | null;
  postId: string;
  onEdit: (comment: CommentItemModel) => void;
  onDelete: (commentId: string) => void | Promise<void>;
  onReply: (comment: CommentItemModel) => void;
}

export function CommentList({
  comments,
  currentUserId,
  selfDisplayHint,
  postId,
  onEdit,
  onDelete,
  onReply
}: CommentListProps) {
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

  const empty = comments.length === 0;
  const menuId = menu?.comment.id;
  const menuReactions = menuId ? reactions[menuId] : undefined;

  return (
    <>
      <div className="comments-app__scroll" ref={scrollRef}>
        {empty ? (
          <div className="chat-empty" aria-live="polite">
            <p className="chat-empty__title">{COMMENT_EMPTY_TITLE}</p>
            <p className="chat-empty__subtitle">{COMMENT_EMPTY_SUBTITLE}</p>
          </div>
        ) : (
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
                  selfDisplayHint={selfDisplayHint}
                  showAvatar={showAvatar}
                  groupedWithPrevious={grouped}
                  onOpenMenu={(c, anchor) => setMenu({ comment: c, x: anchor.x, y: anchor.y })}
                />
              );
            })}
          </ul>
        )}
      </div>
      <CommentContextMenu
        comment={menu?.comment ?? null}
        anchor={menu ? { x: menu.x, y: menu.y } : null}
        currentUserId={currentUserId}
        postId={postId}
        reactionCounts={menuReactions?.counts ?? {}}
        userReaction={menuReactions?.pick}
        onToggleReaction={
          menuId
            ? (emoji) => {
                toggleReaction(menuId, emoji);
              }
            : () => {}
        }
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
