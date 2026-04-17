/**
 * Functional smoke: run from repo root after `pnpm build`.
 * Loads env from this process (use `node --env-file=apps/api/.env scripts/smoke-functional.mjs`).
 * Spawns API + bot via production `node dist/*.js`; bot gets `BOT_MOCK_MAX_API=true` so MAX is not called.
 *
 * Requires `apps/api/.env` (loaded via root script `node --env-file=apps/api/.env`) with DATABASE_URL,
 * ADMIN_SESSION_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, etc.
 * Child API process is always started with NODE_ENV=development + DEV_MAX_AUTH_BYPASS=true for dev-mock auth.
 * Child bot process uses NODE_ENV=development + BOT_MOCK_MAX_API=true so a host `.env` with NODE_ENV=production does not break the mock.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function freePort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const lines = out.split("\n").filter((l) => l.includes("LISTENING"));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const botDir = path.join(root, "apps", "bot");
const envFile = path.join(apiDir, ".env");

const API = process.env.API_BASE_URL || "http://127.0.0.1:3001";
const BOT = process.env.BOT_BASE_URL || "http://127.0.0.1:3002";

async function waitFor(fn, { timeoutMs = 45000, intervalMs = 400 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await fn()) return;
    } catch {
      /* retry */
    }
    await sleep(intervalMs);
  }
  throw new Error("waitFor timeout");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function extractCookie(res, name) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of list) {
    if (line.startsWith(`${name}=`)) return line.split(";")[0].trim();
  }
  const single = res.headers.get("set-cookie");
  if (single?.includes(`${name}=`)) return single.split(";")[0].trim();
  return "";
}

async function main() {
  if (!fs.existsSync(path.join(apiDir, "dist", "server.js"))) {
    throw new Error("Missing apps/api/dist/server.js — run `pnpm build` first");
  }
  if (!fs.existsSync(path.join(botDir, "dist", "index.js"))) {
    throw new Error("Missing apps/bot/dist/index.js — run `pnpm build` first");
  }
  if (!fs.existsSync(envFile)) {
    throw new Error("Missing apps/api/.env");
  }

  freePort(3001);
  freePort(3002);
  await sleep(600);

  const apiArgs = ["--env-file", envFile, "dist/server.js"];
  const botArgs = ["--env-file", envFile, "dist/index.js"];

  const apiEnv = {
    ...process.env,
    NODE_ENV: "development",
    DEV_MAX_AUTH_BYPASS: "true",
    COMMENT_COOLDOWN_SECONDS: "0",
    COMMENT_RATE_LIMIT_MAX: "200",
    BOT_MOCK_MAX_API: process.env.BOT_MOCK_MAX_API ?? "false"
  };
  const botEnv = {
    ...process.env,
    NODE_ENV: "development",
    BOT_MOCK_MAX_API: "true"
  };

  const apiProc = spawn(process.execPath, apiArgs, { cwd: apiDir, stdio: "pipe", env: apiEnv });
  const botProc = spawn(process.execPath, botArgs, { cwd: botDir, stdio: "pipe", env: botEnv });

  const logErr = (name, buf) => {
    const s = buf.toString();
    if (s.trim()) console.error(`[${name}]`, s);
  };
  apiProc.stderr?.on("data", (d) => logErr("api-stderr", d));
  botProc.stderr?.on("data", (d) => logErr("bot-stderr", d));

  try {
    await waitFor(async () => {
      const r = await fetch(`${API}/healthz`);
      return r.ok;
    });

    await waitFor(async () => {
      const r = await fetch(`${BOT}/webhook/max`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      return r.ok;
    });

    const messageId = `smoke-msg-${Date.now()}`;
    const registerRes = await fetch(`${API}/api/internal/posts/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: "smoke-chat-max-1",
        messageId,
        botMessageText: "Smoke post"
      })
    });
    assert(registerRes.ok, `register post ${registerRes.status}`);
    const { id: postId } = await registerRes.json();

    const maxUserId = `smoke-max-user-${Date.now()}`;
    const authRes = await fetch(`${API}/api/auth/max/init`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        devMock: {
          maxUserId,
          username: "smokeuser",
          chatMaxId: "smoke-chat-max-1",
          startParam: `post_${postId}`
        }
      })
    });
    assert(authRes.ok, `dev auth ${authRes.status}`);
    const { userId } = await authRes.json();
    assert(userId, "userId from dev auth");

    const postRes = await fetch(`${API}/api/posts/${postId}`, { headers: { "x-user-id": userId } });
    assert(postRes.ok, `get post ${postRes.status}`);

    const c1Res = await fetch(`${API}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ text: "hello smoke", attachmentIds: [] })
    });
    assert(c1Res.ok, `create comment ${c1Res.status}`);
    const c1 = await c1Res.json();

    const list1 = await fetch(`${API}/api/posts/${postId}/comments`);
    assert(list1.ok, `list comments ${list1.status}`);
    const list1Json = await list1.json();
    assert(list1Json.items?.some((c) => c.id === c1.id), "comment not in public list");

    const patchRes = await fetch(`${API}/api/comments/${c1.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ text: "hello smoke edited" })
    });
    assert(patchRes.ok, `patch own ${patchRes.status}`);

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    assert(adminEmail && adminPassword, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD required in env");

    const loginRes = await fetch(`${API}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    assert(loginRes.ok, `admin login ${loginRes.status}`);
    const cookieHeader = extractCookie(loginRes, "admin_session");
    assert(cookieHeader, "admin session cookie missing");

    const hideRes = await fetch(`${API}/api/admin/comments/${c1.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ action: "hide" })
    });
    assert(hideRes.ok, `admin hide ${hideRes.status}`);

    const listHidden = await fetch(`${API}/api/posts/${postId}/comments`);
    const listHiddenJson = await listHidden.json();
    assert(!listHiddenJson.items?.some((c) => c.id === c1.id), "hidden comment must not appear in public list");

    const restoreRes = await fetch(`${API}/api/admin/comments/${c1.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ action: "restore" })
    });
    assert(restoreRes.ok, `admin restore ${restoreRes.status}`);

    const delAdRes = await fetch(`${API}/api/admin/comments/${c1.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ action: "delete" })
    });
    assert(delAdRes.ok, `admin delete ${delAdRes.status}`);

    const listAfterDel = await fetch(`${API}/api/posts/${postId}/comments`);
    const listAfterDelJson = await listAfterDel.json();
    assert(!listAfterDelJson.items?.some((c) => c.id === c1.id), "deleted comment must not appear in public list");

    const c2Res = await fetch(`${API}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ text: "for own delete", attachmentIds: [] })
    });
    assert(c2Res.ok, `create c2 ${c2Res.status}`);
    const c2 = await c2Res.json();

    const delOwn = await fetch(`${API}/api/comments/${c2.id}`, { method: "DELETE", headers: { "x-user-id": userId } });
    assert(delOwn.ok, `delete own ${delOwn.status}`);

    const restrictRes = await fetch(`${API}/api/admin/restrictions`, {
      method: "POST",
      headers: { "content-type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({
        userId,
        restrictionType: "temporary_mute",
        reason: "smoke",
        endsAt: new Date(Date.now() + 3600_000).toISOString()
      })
    });
    assert(restrictRes.ok, `create restriction ${restrictRes.status}`);
    const restriction = await restrictRes.json();

    const blockComment = await fetch(`${API}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ text: "should fail", attachmentIds: [] })
    });
    assert(blockComment.status === 403, "muted user must not create comment");

    const revokeRes = await fetch(`${API}/api/admin/restrictions/${restriction.id}/revoke`, {
      method: "POST",
      headers: { Cookie: cookieHeader }
    });
    assert(revokeRes.ok, `revoke restriction ${revokeRes.status}`);

    const modlog = await fetch(`${API}/api/admin/moderation-actions`, { headers: { Cookie: cookieHeader } });
    assert(modlog.ok, `modlog ${modlog.status}`);
    const modlogJson = await modlog.json();
    assert((modlogJson.items?.length ?? 0) > 0, "moderation log should have entries");

    const pngB64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pngBuf = Buffer.from(pngB64, "base64");
    const fd = new FormData();
    fd.append("file", new Blob([pngBuf], { type: "image/png" }), "smoke.png");
    const upRes = await fetch(`${API}/api/uploads/comment-image`, { method: "POST", body: fd });
    assert(upRes.ok, `upload png ${upRes.status}`);
    const attachment = await upRes.json();

    const c3Res = await fetch(`${API}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ text: "with image", attachmentIds: [attachment.id] })
    });
    assert(c3Res.ok, `comment with attachment ${c3Res.status}`);
    const c3 = await c3Res.json();

    const staticUrl = attachment.url.startsWith("http") ? attachment.url : new URL(attachment.url, API).href;
    const staticRes = await fetch(staticUrl);
    assert(staticRes.ok, `static file ${staticRes.status}`);

    const badMime = new FormData();
    badMime.append("file", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "x.txt");
    const badMimeRes = await fetch(`${API}/api/uploads/comment-image`, { method: "POST", body: badMime });
    assert(badMimeRes.status === 400, "invalid mime should be 400");

    const syncRes = await fetch(`${API}/api/internal/posts/${postId}/sync-button`, { method: "POST" });
    assert(syncRes.ok, `sync-button ${syncRes.status}`);

    const adminGet = await fetch(`${API}/api/admin/comments/${c3.id}`, { headers: { Cookie: cookieHeader } });
    assert(adminGet.ok, `admin get comment ${adminGet.status}`);
    const adminJson = await adminGet.json();
    assert(adminJson.attachments?.length >= 1, "comment should list attachment in admin");

    const meBeforeLogout = await fetch(`${API}/api/admin/auth/me`, { headers: { Cookie: cookieHeader } });
    assert(meBeforeLogout.ok, `admin me before logout ${meBeforeLogout.status}`);

    const logoutRes = await fetch(`${API}/api/admin/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader }
    });
    assert(logoutRes.ok, `admin logout ${logoutRes.status}`);

    const meAfterLogout = await fetch(`${API}/api/admin/auth/me`, { headers: { Cookie: cookieHeader } });
    assert(meAfterLogout.status === 401, `admin me after logout must be 401, got ${meAfterLogout.status}`);

    const protectedAfterLogout = await fetch(`${API}/api/admin/moderation-actions`, {
      headers: { Cookie: cookieHeader }
    });
    assert(
      protectedAfterLogout.status === 401,
      `protected admin route after logout must be 401, got ${protectedAfterLogout.status}`
    );

    console.log("FUNCTIONAL_SMOKE_OK");
  } finally {
    apiProc.kill("SIGTERM");
    botProc.kill("SIGTERM");
    await sleep(500);
    try {
      apiProc.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    try {
      botProc.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
