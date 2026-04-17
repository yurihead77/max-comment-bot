import type { PrismaClient } from "@prisma/client";

export async function getActiveRestriction(prisma: PrismaClient, userId: string) {
  const now = new Date();

  const restriction = await prisma.userRestriction.findFirst({
    where: {
      userId,
      scopeType: "global",
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }]
    },
    orderBy: { createdAt: "desc" }
  });

  return restriction;
}
