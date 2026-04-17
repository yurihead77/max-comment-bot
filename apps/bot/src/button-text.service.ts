export function getDiscussButtonText(activeCount: number) {
  return activeCount > 0 ? `Обсудить (${activeCount})` : "Обсудить";
}
