/**
 * Central UI copy for comments / context menu.
 * Keeps literals in one module so production bundles always contain these UTF-8 strings
 * (useful to grep `dist/assets/*.js` for: Ответить, Скопировать, Пожаловаться).
 */
export const COMMENT_CTX_REPLY = "Ответить";
export const COMMENT_CTX_COPY_TEXT = "Скопировать текст";
export const COMMENT_CTX_COPY_LINK = "Скопировать ссылку";
export const COMMENT_CTX_EDIT = "Изменить";
export const COMMENT_CTX_DELETE = "Удалить";
export const COMMENT_CTX_REPORT = "Пожаловаться";
export const COMMENT_EMPTY_TITLE = "Пока нет комментариев";
export const COMMENT_EMPTY_SUBTITLE = "Будьте первым";
export const COMMENT_REPLY_PREVIEW_TITLE = "Ответ на сообщение";
export const COMMENT_NO_POST = "Нет поста для обсуждения";
