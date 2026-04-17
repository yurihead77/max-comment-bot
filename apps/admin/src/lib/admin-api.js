const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export async function adminLogin(email, password) {
    const response = await fetch(`${API_BASE}/api/admin/auth/login`, {
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
export async function getAdminComments() {
    const response = await fetch(`${API_BASE}/api/admin/comments`, {
        credentials: "include"
    });
    return response.json();
}
export async function moderateComment(commentId, action) {
    const response = await fetch(`${API_BASE}/api/admin/comments/${commentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
    });
    if (!response.ok) {
        throw new Error("moderation failed");
    }
}
export async function getRestrictions() {
    const response = await fetch(`${API_BASE}/api/admin/restrictions`, {
        credentials: "include"
    });
    return response.json();
}
export async function createRestriction(payload) {
    const response = await fetch(`${API_BASE}/api/admin/restrictions`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error("failed to create restriction");
    }
}
export async function getModerationLog() {
    const response = await fetch(`${API_BASE}/api/admin/moderation-actions`, {
        credentials: "include"
    });
    return response.json();
}
