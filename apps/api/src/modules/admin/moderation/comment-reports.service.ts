import type { PrismaClient } from "@prisma/client";

export async function resolveOpenReportsForComment(
  prisma: PrismaClient,
  commentId: string,
  status: "resolved_keep" | "resolved_delete"
): Promise<number> {
  const r = await prisma.commentReport.updateMany({
    where: { commentId, status: "open" },
    data: { status }
  });
  return r.count;
}
