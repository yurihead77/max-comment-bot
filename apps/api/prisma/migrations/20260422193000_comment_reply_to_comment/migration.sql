-- AlterTable
ALTER TABLE "comments"
ADD COLUMN "reply_to_comment_id" TEXT;

-- CreateIndex
CREATE INDEX "comments_reply_to_comment_id_idx" ON "comments"("reply_to_comment_id");

-- AddForeignKey
ALTER TABLE "comments"
ADD CONSTRAINT "comments_reply_to_comment_id_fkey"
FOREIGN KEY ("reply_to_comment_id") REFERENCES "comments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
