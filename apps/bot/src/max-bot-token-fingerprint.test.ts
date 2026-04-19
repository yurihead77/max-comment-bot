import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maxBotTokenSha256Prefix } from "./max-bot-token-fingerprint";

describe("maxBotTokenSha256Prefix", () => {
  it("returns stable-length hex prefix", () => {
    const p = maxBotTokenSha256Prefix("test-token-123", 12);
    assert.equal(p.length, 12);
    assert.match(p, /^[0-9a-f]{12}$/);
  });

  it("differs for different tokens", () => {
    assert.notEqual(maxBotTokenSha256Prefix("a"), maxBotTokenSha256Prefix("b"));
  });
});
