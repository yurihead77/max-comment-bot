interface DateDividerProps {
  label: string;
}

export function DateDivider({ label }: DateDividerProps) {
  return (
    <div className="chat-date-divider" aria-label={label}>
      <span className="chat-date-divider__pill">{label}</span>
    </div>
  );
}

export function formatDateDividerLabel(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now).getTime() - startOf(d).getTime()) / dayMs);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
