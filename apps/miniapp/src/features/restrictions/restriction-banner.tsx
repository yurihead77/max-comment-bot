interface RestrictionBannerProps {
  restriction: null | {
    type: string;
    endsAt: string | null;
  };
}

export function RestrictionBanner({ restriction }: RestrictionBannerProps) {
  if (!restriction) {
    return null;
  }
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "rgba(251, 191, 36, 0.12)",
        border: "1px solid rgba(251, 191, 36, 0.35)",
        borderRadius: 10,
        color: "#fcd34d",
        fontSize: "0.875rem"
      }}
    >
      {restriction.type === "temporary_mute" ? (
        <p>Комментирование временно недоступно до {restriction.endsAt ?? "неизвестной даты"}.</p>
      ) : (
        <p>Вы заблокированы для публикации комментариев.</p>
      )}
    </div>
  );
}
