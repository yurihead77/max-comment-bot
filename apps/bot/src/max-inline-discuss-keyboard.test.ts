import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscussInlineKeyboardAttachment } from "./max-inline-discuss-keyboard";

describe("buildDiscussInlineKeyboardAttachment", () => {
  it("open_app uses web_app + payload", () => {
    const a = buildDiscussInlineKeyboardAttachment({
      mode: "open_app",
      targetUrl: "https://example.com/app",
      buttonText: "Обсудить",
      startParam: "post_abc"
    });
    assert.equal(a.type, "inline_keyboard");
    assert.deepEqual(a.payload.buttons, [
      [{ type: "open_app", text: "Обсудить", web_app: "https://example.com/app", payload: "post_abc" }]
    ]);
  });

  it("link uses url, ignores startParam for shape", () => {
    const a = buildDiscussInlineKeyboardAttachment({
      mode: "link",
      targetUrl: "https://example.com/app",
      buttonText: "Debug link",
      startParam: "ignored-for-link"
    });
    assert.deepEqual(a.payload.buttons, [[{ type: "link", text: "Debug link", url: "https://example.com/app" }]]);
  });
});
