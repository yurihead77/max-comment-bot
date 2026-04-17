export type CommentStatus = "active" | "hidden" | "deleted";

export type RestrictionType = "temporary_mute" | "permanent_block";

export type RestrictionScopeType = "global" | "chat";

export interface AppConfig {
  maxCommentLength: number;
  maxAttachmentsPerComment: number;
  maxImageSizeMb: number;
  commentEditWindowMinutes: number;
  userCanDeleteOwnComment: boolean;
}
