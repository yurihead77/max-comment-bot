import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscussInlineKeyboardAttachment } from "./max-inline-discuss-keyboard";

describe("buildDiscussInlineKeyboardAttachment", () => {
  it("open_app uses web_app + payload", () => {
    const openAppId = process.env.MAX_OPEN_APP_ID ?? "id782576604170_2_bot";
    const a = buildDiscussInlineKeyboardAttachment({
      mode: "open_app",
      openAppWebApp: openAppId,
      openAppContactId: 247954163,
      linkUrl: "https://example.com/app",
      buttonText: "Обсудить",
      startParam: "post_abc"
    });
    assert.equal(a.type, "inline_keyboard");
    assert.deepEqual(a.payload.buttons, [
      [{ type: "open_app", text: "Обсудить", web_app: openAppId, payload: "post_abc", contact_id: 247954163 }]
    ]);
  });

  it("link uses url, ignores startParam for shape", () => {
    const a = buildDiscussInlineKeyboardAttachment({
      mode: "link",
      openAppWebApp: "id782576604170_2_bot",
      linkUrl: "https://example.com/app",
      buttonText: "Debug link",
      startParam: "ignored-for-link"
    });
    assert.deepEqual(a.payload.buttons, [[{ type: "link", text: "Debug link", url: "https://example.com/app" }]]);
  });
});
