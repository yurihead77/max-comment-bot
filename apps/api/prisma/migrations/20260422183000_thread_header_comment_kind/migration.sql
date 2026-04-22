-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('comment', 'thread_header');

-- AlterTable
ALTER TABLE "comments"
ADD COLUMN "kind" "CommentKind" NOT NULL DEFAULT 'comment',
ADD COLUMN "thread_header_key" TEXT,
ADD COLUMN "system_author" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "comments_thread_header_key_key" ON "comments"("thread_header_key");

-- CreateIndex
CREATE INDEX "comments_post_id_kind_status_created_at_idx" ON "comments"("post_id", "kind", "status", "created_at");
