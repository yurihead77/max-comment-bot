-- enums
CREATE TYPE "CommentStatus" AS ENUM ('active', 'hidden', 'deleted');
CREATE TYPE "RestrictionScopeType" AS ENUM ('global', 'chat');
CREATE TYPE "RestrictionType" AS ENUM ('temporary_mute', 'permanent_block');
CREATE TYPE "AdminRole" AS ENUM ('admin', 'moderator');

-- core entities
CREATE TABLE "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "max_user_id" TEXT NOT NULL UNIQUE,
  "username" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "photo_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "chats" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "max_chat_id" TEXT NOT NULL UNIQUE,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "posts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chat_id" TEXT NOT NULL,
  "max_message_id" TEXT NOT NULL,
  "bot_message_text" TEXT,
  "comments_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "posts_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id")
);
CREATE UNIQUE INDEX "posts_chat_id_max_message_id_key" ON "posts"("chat_id", "max_message_id");

CREATE TABLE "comments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "post_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "parent_comment_id" TEXT,
  "text" TEXT NOT NULL,
  "status" "CommentStatus" NOT NULL DEFAULT 'active',
  "is_edited" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "edited_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "hidden_at" TIMESTAMP(3),
  CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id"),
  CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id")
);
CREATE INDEX "comments_post_id_status_created_at_idx" ON "comments"("post_id", "status", "created_at");

CREATE TABLE "comment_attachments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "comment_id" TEXT,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL
);

CREATE TABLE "comment_edit_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "comment_id" TEXT NOT NULL,
  "editor_user_id" TEXT NOT NULL,
  "old_text" TEXT NOT NULL,
  "new_text" TEXT NOT NULL,
  "edited_by_role" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_edit_history_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id")
);

CREATE TABLE "user_restrictions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "scope_type" "RestrictionScopeType" NOT NULL DEFAULT 'global',
  "chat_id" TEXT,
  "restriction_type" "RestrictionType" NOT NULL,
  "reason" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" TEXT NOT NULL,
  "updated_by_user_id" TEXT,
  "revoked_by_user_id" TEXT,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);
CREATE INDEX "user_restrictions_user_id_scope_type_is_active_idx" ON "user_restrictions"("user_id", "scope_type", "is_active");

CREATE TABLE "moderation_actions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action_type" TEXT NOT NULL,
  "target_user_id" TEXT,
  "target_comment_id" TEXT,
  "target_post_id" TEXT,
  "performed_by_user_id" TEXT NOT NULL,
  "reason" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "admin_users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "admin_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "admin_user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE
);

CREATE TABLE "sync_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "post_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "sync_jobs_post_id_status_idx" ON "sync_jobs"("post_id", "status");
