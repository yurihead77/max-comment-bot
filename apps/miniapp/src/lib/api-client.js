const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
export async function authByInitData(initData) {
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
export async function authByDevMock(payload) {
    const response = await fetch(`${API_BASE}/auth/max/init`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devMock: payload })
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`dev auth failed: ${response.status} ${errText}`);
    }
    return response.json();
}
export async function getPost(postId, userId) {
    const response = await fetch(`${API_BASE}/posts/${postId}`, {
        headers: { "x-user-id": userId }
    });
    return response.json();
}
export async function getComments(postId, opts) {
    const q = opts?.includeHidden ? "?includeHidden=true" : "";
    const response = await fetch(`${API_BASE}/posts/${postId}/comments${q}`);
    return response.json();
}
export async function getModerationReportContext(reportId, userId) {
    const response = await fetch(`${API_BASE}/moderation/reports/${encodeURIComponent(reportId)}/context`, {
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`report context failed: ${response.status} ${errText}`);
    }
    return response.json();
}
export async function resolveModerationReportKeep(reportId, userId) {
    const response = await fetch(`${API_BASE}/moderation/reports/${encodeURIComponent(reportId)}/resolve-keep`, {
        method: "POST",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`resolve keep failed: ${response.status} ${errText}`);
    }
    return response.json();
}
export async function createComment(postId, userId, text, attachmentIds = []) {
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
export async function updateOwnComment(commentId, userId, text) {
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
export async function reportComment(commentId, userId, reason) {
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
    return response.json();
}
export async function deleteOwnComment(commentId, userId) {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to delete comment");
    }
}
export async function uploadCommentImage(file) {
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
export async function getMeRole(userId) {
    const response = await fetch(`${API_BASE}/me/role`, {
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to get role");
    }
    return response.json();
}
export async function moderateCommentByModerator(userId, commentId, action) {
    const response = await fetch(`${API_BASE}/moderation/comments/${commentId}/${action}`, {
        method: "POST",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to moderate comment");
    }
    return response.json();
}
export async function muteUserByModerator(userId, targetUserId) {
    const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/mute`, {
        method: "POST",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to mute user");
    }
}
export async function blockUserByModerator(userId, targetUserId) {
    const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/block`, {
        method: "POST",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to block user");
    }
}
export async function unblockUserByModerator(userId, targetUserId) {
    const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/unblock`, {
        method: "POST",
        headers: { "x-user-id": userId }
    });
    if (!response.ok) {
        throw new Error("failed to unblock user");
    }
}
export async function getModerationUserState(actorUserId, targetUserId) {
    const response = await fetch(`${API_BASE}/moderation/users/${targetUserId}/state`, {
        headers: { "x-user-id": actorUserId }
    });
    if (!response.ok) {
        throw new Error("failed to fetch moderation state");
    }
    return response.json();
}
