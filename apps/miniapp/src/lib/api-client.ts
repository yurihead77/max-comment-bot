const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function authByInitData(initData: string) {
  const response = await fetch(`${API_BASE}/api/auth/max/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData })
  });
  if (!response.ok) {
    throw new Error("auth failed");
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
  const response = await fetch(`${API_BASE}/api/auth/max/init`, {
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
  const response = await fetch(`${API_BASE}/api/posts/${postId}`, {
    headers: { "x-user-id": userId }
  });
  return response.json();
}

export async function getComments(postId: string) {
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`);
  return response.json();
}

export async function createComment(postId: string, userId: string, text: string, attachmentIds: string[] = []) {
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
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
  const response = await fetch(`${API_BASE}/api/comments/${commentId}`, {
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

export async function deleteOwnComment(commentId: string, userId: string) {
  const response = await fetch(`${API_BASE}/api/comments/${commentId}`, {
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
  const response = await fetch(`${API_BASE}/api/uploads/comment-image`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("upload failed");
  }
  return response.json();
}
