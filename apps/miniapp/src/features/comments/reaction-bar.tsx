export interface ReactionState {
  counts: Record<string, number>;
  pick?: string;
}

interface ReactionBarProps {
  state?: ReactionState;
  onToggleReaction: (emoji: string) => void;
}

export function ReactionBar({ state, onToggleReaction }: ReactionBarProps) {
  const entries = Object.entries(state?.counts ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <div className="chat-reactions" aria-label="Реакции">
      {entries.map(([emoji, count]) => {
        const active = state?.pick === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className={"chat-reactions__item" + (active ? " chat-reactions__item--active" : "")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction(emoji);
            }}
          >
            <span className="chat-reactions__emoji">{emoji}</span>
            <span className="chat-reactions__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
