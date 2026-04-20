import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isDevMaxAuthBypassEnabled } from "../../config/env";
import { MaxInitDataValidationError, validateAndParseInitData } from "./max-initdata.service";

const devMockSchema = z.object({
  maxUserId: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  chatMaxId: z.string().optional(),
  startParam: z.string().optional()
});

const bodySchema = z
  .object({
    initData: z.string().min(1).optional(),
    devMock: devMockSchema.optional()
  })
  .refine((b) => Boolean(b.initData) || Boolean(b.devMock), {
    message: "initData or devMock is required"
  });

export const maxAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/max/init", async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    if (parsed.data.devMock) {
      if (!isDevMaxAuthBypassEnabled()) {
        return reply.code(403).send({ error: "dev mock auth is disabled" });
      }
      const mock = parsed.data.devMock;
      const dbUser = await app.prisma.user.upsert({
        where: { maxUserId: String(mock.maxUserId) },
        create: {
          maxUserId: String(mock.maxUserId),
          username: mock.username,
          firstName: mock.firstName,
          lastName: mock.lastName
        },
        update: {
          username: mock.username,
          firstName: mock.firstName,
          lastName: mock.lastName
        }
      });
      if (mock.chatMaxId) {
        await app.prisma.chat.upsert({
          where: { maxChatId: String(mock.chatMaxId) },
          create: { maxChatId: String(mock.chatMaxId), type: "group" },
          update: {}
        });
      }
      return {
        userId: dbUser.id,
        maxUserId: dbUser.maxUserId,
        startParam: mock.startParam ?? null,
        devMock: true as const
      };
    }

    let maxPayload;
    try {
      maxPayload = validateAndParseInitData(parsed.data.initData!);
    } catch (error) {
      if (error instanceof MaxInitDataValidationError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
    const user = maxPayload.user;

    const dbUser = await app.prisma.user.upsert({
      where: { maxUserId: String(user.id) },
      create: {
        maxUserId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url
      },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url
      }
    });

    if (maxPayload.chat) {
      await app.prisma.chat.upsert({
        where: { maxChatId: String(maxPayload.chat.id) },
        create: {
          maxChatId: String(maxPayload.chat.id),
          type: maxPayload.chat.type ?? "group",
          title: maxPayload.chat.title
        },
        update: {
          type: maxPayload.chat.type ?? "group",
          title: maxPayload.chat.title
        }
      });
    }

    return {
      userId: dbUser.id,
      maxUserId: dbUser.maxUserId,
      startParam: maxPayload.start_param ?? null
    };
  });
};
