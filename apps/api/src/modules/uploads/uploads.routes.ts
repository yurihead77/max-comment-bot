import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../../config/env";
import { buildUploadPublicFileUrl } from "../../lib/upload-public-url";

const allowedMimeTypes = new Set(
  env.ALLOWED_IMAGE_MIME_TYPES.split(",").map((v) => v.trim().toLowerCase())
);

export const uploadsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/uploads/comment-image", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "file is required" });
    }
    if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
      return reply.code(400).send({ error: "mime type not allowed" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const maxSize = env.MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxSize) {
      return reply.code(400).send({ error: "file too large" });
    }

    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    const extension = path.extname(file.filename) || ".bin";
    const filename = `${crypto.randomUUID()}${extension}`;
    const fullPath = path.join(env.UPLOAD_DIR, filename);
    await fs.writeFile(fullPath, buffer);

    const url = buildUploadPublicFileUrl(env.UPLOAD_PUBLIC_BASE_URL, filename);
    const attachment = await app.prisma.commentAttachment.create({
      data: {
        type: "image",
        url,
        mimeType: file.mimetype,
        fileSize: buffer.length
      }
    });

    return attachment;
  });
};
