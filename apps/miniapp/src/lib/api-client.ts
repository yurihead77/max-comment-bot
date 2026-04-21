const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export async function authByInitData(initData: string) {
  const response = await fetch(`${API_BASE}/auth/max/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`auth failed: ${response.status} ${errText}`);
  }
  return response.json();
}

export async function authByDevMock(payload: {
  maxUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatMaxId?: string;
  startParam?: string;
}) {
  const response = await fetch(`${API_BASE}/auth/max/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devMock: payload })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`dev auth failed: ${response.status} ${errText}`);
  }
  return response.json() as Promise<{
    userId: string;
    maxUserId: string;
    startParam: string | null;
    devMock?: true;
  }>;
}

export async function getPost(postId: string, userId: string) {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    headers: { "x-user-id": userId }
  });
  return response.json();
}

export async function getComments(postId: string) {
  const response = await fetch(`${API_BASE}/posts/${postId}/comments`);
  return response.json();
}

export async function createComment(postId: string, userId: string, text: string, attachmentIds: string[] = []) {
  const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId
    },
    body: JSON.stringify({ text, attachmentIds })
  });
  if (!response.ok) {
    throw new Error("failed to create comment");
  }
  return response.json();
}

export async function updateOwnComment(commentId: string, userId: string, text: string) {
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId
    },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    throw new Error("failed to update comment");
  }
  return response.json();
}

export async function reportComment(commentId: string, userId: string, reason?: string) {
  const response = await fetch(`${API_BASE}/comments/${commentId}/report`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId
    },
    body: JSON.stringify({ reason: reason ?? undefined })
  });
  if (!response.ok) {
    throw new Error("failed to report comment");
  }
  return response.json() as Promise<{ ok: boolean; duplicate?: boolean; openReportsCount: number }>;
}

export async function deleteOwnComment(commentId: string, userId: string) {
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to delete comment");
  }
}

export async function uploadCommentImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/uploads/comment-image`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("upload failed");
  }
  return response.json();
}

export async function getMeRole(userId: string) {
  const response = await fetch(`${API_BASE}/me/role`, {
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to get role");
  }
  return response.json() as Promise<{ role: "user" | "moderator" }>;
}

export async function moderateCommentByModerator(
  userId: string,
  commentId: string,
  action: "hide" | "delete" | "restore"
) {
  const response = await fetch(`${API_BASE}/moderation/comments/${commentId}/${action}`, {
    method: "POST",
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to moderate comment");
  }
  return response.json();
}

export async function muteUserByModerator(userId: string, targetUserId: string) {
  const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/mute`, {
    method: "POST",
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to mute user");
  }
}

export async function blockUserByModerator(userId: string, targetUserId: string) {
  const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/block`, {
    method: "POST",
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to block user");
  }
}

export async function unblockUserByModerator(userId: string, targetUserId: string) {
  const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/unblock`, {
    method: "POST",
    headers: { "x-user-id": userId }
  });
  if (!response.ok) {
    throw new Error("failed to unblock user");
  }
}

export async function getModerationUserState(actorUserId: string, targetUserId: string) {
  const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/state`, {
    headers: { "x-user-id": actorUserId }
  });
  if (!response.ok) {
    throw new Error("failed to fetch moderation state");
  }
  return response.json() as Promise<{
    userId: string;
    platformUserId: string;
    isSelf: boolean;
    isTargetModerator: boolean;
    isMuted: boolean;
    isBlocked: boolean;
    activeRestrictions: Array<{
      id: string;
      type: "mute" | "block";
      createdAt: string;
      expiresAt: string | null;
      reason: string | null;
    }>;
  }>;
}
