const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function adminLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error("login failed");
  }
  return response.json();
}

type CommentFilters = {
  status?: "active" | "hidden" | "deleted";
  channelId?: string;
  text?: string;
  authorUserId?: string;
  reportedOnly?: "true" | "false";
  page?: number;
  pageSize?: number;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const asString = search.toString();
  return asString ? `?${asString}` : "";
}

export async function getAdminComments(filters: CommentFilters = {}) {
  const response = await fetch(`${API_BASE}/admin/comments${toQuery(filters)}`, {
    credentials: "include"
  });
  return response.json();
}

export async function getAdminCommentDetails(commentId: string) {
  const response = await fetch(`${API_BASE}/admin/comments/${commentId}`, {
    credentials: "include"
  });
  return response.json();
}

export async function moderateComment(commentId: string, action: "hide" | "unhide" | "delete" | "restore") {
  const response = await fetch(`${API_BASE}/admin/comments/${commentId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action })
  });
  if (!response.ok) {
    throw new Error("moderation failed");
  }
}

export async function getChannels() {
  const response = await fetch(`${API_BASE}/admin/channels`, {
    credentials: "include"
  });
  return response.json();
}

export async function getRestrictions(filters: { type?: "mute" | "block"; active?: "true" | "false" } = {}) {
  const response = await fetch(`${API_BASE}/admin/restrictions${toQuery(filters)}`, {
    credentials: "include"
  });
  return response.json();
}

export async function createRestriction(payload: {
  userId: string;
  type: "mute" | "block";
  reason?: string;
  expiresAt?: string;
}) {
  const response = await fetch(`${API_BASE}/admin/restrictions`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("failed to create restriction");
  }
}

export async function revokeRestriction(restrictionId: string) {
  const response = await fetch(`${API_BASE}/admin/restrictions/${restrictionId}/revoke`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("failed to revoke restriction");
  }
}

export async function getModerationLog(filters: { actionType?: string; page?: number; pageSize?: number } = {}) {
  const response = await fetch(`${API_BASE}/admin/moderation-actions${toQuery(filters)}`, {
    credentials: "include"
  });
  return response.json();
}

export async function getModerators() {
  const response = await fetch(`${API_BASE}/admin/moderators`, {
    credentials: "include"
  });
  return response.json();
}

export async function assignModerator(platformUserId: string) {
  const response = await fetch(`${API_BASE}/admin/moderators`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platformUserId })
  });
  if (!response.ok) {
    throw new Error("failed to assign moderator");
  }
}

export async function revokeModerator(platformUserId: string) {
  const response = await fetch(`${API_BASE}/admin/moderators/${platformUserId}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("failed to revoke moderator");
  }
}

export async function getAdminSettings() {
  const response = await fetch(`${API_BASE}/admin/settings`, {
    credentials: "include"
  });
  return response.json() as Promise<{ moderationChatId: string | null }>;
}

export async function patchAdminSettings(body: { moderationChatId: string | null }) {
  const response = await fetch(`${API_BASE}/admin/settings`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error("failed to save settings");
  }
  return response.json() as Promise<{ moderationChatId: string | null }>;
}
