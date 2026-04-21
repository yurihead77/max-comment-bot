const cache: { value: { moderationChatMaxId: string | null } | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0
};

const TTL_MS = 30_000;

export async function getInternalAppSettings(apiBaseUrl: string): Promise<{ moderationChatMaxId: string | null }> {
  const now = Date.now();
  if (cache.value && now - cache.fetchedAt < TTL_MS) {
    return cache.value;
  }
  const base = apiBaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/internal/app-settings`);
  if (!res.ok) {
    cache.value = { moderationChatMaxId: null };
    cache.fetchedAt = now;
    return cache.value;
  }
  const json = (await res.json()) as { moderationChatMaxId?: string | null };
  const moderationChatMaxId = json.moderationChatMaxId?.trim() || null;
  cache.value = { moderationChatMaxId };
  cache.fetchedAt = now;
  return cache.value;
}

export function isModerationChatId(
  settings: { moderationChatMaxId: string | null },
  chatId: string
): boolean {
  if (!settings.moderationChatMaxId) return false;
  return settings.moderationChatMaxId === chatId.trim();
}
