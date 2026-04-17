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
    <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8 }}>
      {restriction.type === "temporary_mute" ? (
        <p>Комментирование временно недоступно до {restriction.endsAt ?? "неизвестной даты"}.</p>
      ) : (
        <p>Вы заблокированы для публикации комментариев.</p>
      )}
    </div>
  );
}
