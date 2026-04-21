-- CreateTable
CREATE TABLE "moderators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moderators_user_id_key" ON "moderators"("user_id");

-- AlterTable
ALTER TABLE "moderation_actions" ADD COLUMN "target_type" TEXT;
ALTER TABLE "moderation_actions" ADD COLUMN "target_id" TEXT;
ALTER TABLE "moderation_actions" ADD COLUMN "performed_by_type" TEXT;
ALTER TABLE "moderation_actions" ADD COLUMN "metadata_json" JSONB;

-- AddForeignKey
ALTER TABLE "moderators" ADD CONSTRAINT "moderators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
