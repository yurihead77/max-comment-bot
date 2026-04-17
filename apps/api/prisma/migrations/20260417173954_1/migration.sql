-- DropForeignKey
ALTER TABLE "admin_sessions" DROP CONSTRAINT "admin_sessions_admin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "comment_attachments" DROP CONSTRAINT "comment_attachments_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "comment_edit_history" DROP CONSTRAINT "comment_edit_history_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "user_restrictions" DROP CONSTRAINT "user_restrictions_user_id_fkey";

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_edit_history" ADD CONSTRAINT "comment_edit_history_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
