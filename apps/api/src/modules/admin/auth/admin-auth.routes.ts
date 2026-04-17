import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/admin/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const adminUser = await app.prisma.adminUser.findUnique({
      where: { email: parsed.data.email }
    });
    if (!adminUser || !adminUser.isActive) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, adminUser.passwordHash);
    if (!passwordOk) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    await app.createAdminSession(reply, adminUser.id);
    return {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    };
  });

  app.post("/api/admin/auth/logout", async (request, reply) => {
    await app.clearAdminSession(request, reply);
    return { ok: true };
  });

  app.get("/api/admin/auth/me", async (request, reply) => {
    if (!request.adminSession) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const adminUser = await app.prisma.adminUser.findUnique({
      where: { id: request.adminSession.adminUserId },
      select: { id: true, email: true, role: true }
    });
    return adminUser;
  });
};
