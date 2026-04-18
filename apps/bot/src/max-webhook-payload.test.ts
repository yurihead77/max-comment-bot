import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractChatIdFromMessage,
  extractMessageIdFromMessage,
  extractMessageText,
  parseMaxUpdate
} from "./max-webhook-payload";

describe("max-webhook-payload", () => {
  it("extracts chatId from message.chat.id and message_id from production-like payload", () => {
    const body = {
      update_type: "message_created",
      message: {
        message_id: "123",
        chat: { id: "456" },
        text: "test"
      }
    };
    const parsed = parseMaxUpdate(body as Record<string, unknown>);
    assert.equal(parsed.kind, "message_created");
    if (parsed.kind !== "message_created") return;

    const chatId = extractChatIdFromMessage(parsed.message);
    const messageId = extractMessageIdFromMessage(parsed.message);
    const msgText = extractMessageText(parsed.message);

    assert.equal(chatId, "456");
    assert.equal(messageId, "123");
    assert.equal(msgText, "test");
  });

  it("coerces numeric chat.id and message_id to string", () => {
    const message = {
      message_id: 999,
      chat: { id: -100123 },
      text: "hi"
    } as Record<string, unknown>;
    assert.equal(extractChatIdFromMessage(message), "-100123");
    assert.equal(extractMessageIdFromMessage(message), "999");
  });

  it("still reads recipient.chat_id when chat object absent", () => {
    const message = {
      message_id: "1",
      recipient: { chat_id: "-55" }
    } as Record<string, unknown>;
    assert.equal(extractChatIdFromMessage(message), "-55");
    assert.equal(extractMessageIdFromMessage(message), "1");
  });
});
