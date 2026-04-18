import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractChatIdFromMessage,
  extractMessageIdFromMessage,
  extractMessageIdFromMessagesApiResponse,
  extractMessageText,
  parseMaxUpdate
} from "./max-webhook-payload";

describe("max-webhook-payload", () => {
  it("extracts chatId and prefers body.mid over Telegram-style message_id (MAX PUT uses mid)", () => {
    const body = {
      update_type: "message_created",
      message: {
        message_id: "123",
        chat: { id: "456" },
        body: { mid: "real-mid-from-max", text: "test" },
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
    assert.equal(messageId, "real-mid-from-max");
    assert.equal(msgText, "test");
  });

  it("falls back to message_id when body.mid absent (synthetic / old payloads)", () => {
    const message = {
      message_id: "123",
      chat: { id: "456" },
      text: "test"
    } as Record<string, unknown>;
    assert.equal(extractMessageIdFromMessage(message), "123");
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

  it("extractMessageIdFromMessagesApiResponse reads nested message.body.mid", () => {
    const envelope = {
      message: {
        body: { mid: "post-response-mid-1" },
        recipient: { chat_id: "1" }
      }
    } as Record<string, unknown>;
    assert.equal(extractMessageIdFromMessagesApiResponse(envelope), "post-response-mid-1");
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
