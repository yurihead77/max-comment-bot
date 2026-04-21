const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
export async function adminLogin(email, password) {
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
function toQuery(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
            search.set(key, String(value));
        }
    }
    const asString = search.toString();
    return asString ? `?${asString}` : "";
}
export async function getAdminComments(filters = {}) {
    const response = await fetch(`${API_BASE}/admin/comments${toQuery(filters)}`, {
        credentials: "include"
    });
    return response.json();
}
export async function getAdminCommentDetails(commentId) {
    const response = await fetch(`${API_BASE}/admin/comments/${commentId}`, {
        credentials: "include"
    });
    return response.json();
}
export async function moderateComment(commentId, action) {
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
export async function getRestrictions(filters = {}) {
    const response = await fetch(`${API_BASE}/admin/restrictions${toQuery(filters)}`, {
        credentials: "include"
    });
    return response.json();
}
export async function createRestriction(payload) {
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
export async function revokeRestriction(restrictionId) {
    const response = await fetch(`${API_BASE}/admin/restrictions/${restrictionId}/revoke`, {
        method: "POST",
        credentials: "include"
    });
    if (!response.ok) {
        throw new Error("failed to revoke restriction");
    }
}
export async function getModerationLog(filters = {}) {
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
export async function assignModerator(userId) {
    const response = await fetch(`${API_BASE}/admin/moderators`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId })
    });
    if (!response.ok) {
        throw new Error("failed to assign moderator");
    }
}
export async function revokeModerator(userId) {
    const response = await fetch(`${API_BASE}/admin/moderators/${userId}`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!response.ok) {
        throw new Error("failed to revoke moderator");
    }
}
