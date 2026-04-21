/** Deep-link unit for moderation: `report_<id>` or compact `r_<id>`. */
export function parseReportIdFromStartParam(startParam: string | null | undefined): string | null {
  if (!startParam) return null;
  const s = startParam.trim();
  const mReport = /^report_(.+)$/.exec(s);
  if (mReport?.[1]) return mReport[1].trim() || null;
  const mShort = /^r_(.+)$/.exec(s);
  if (mShort?.[1]) return mShort[1].trim() || null;
  return null;
}
