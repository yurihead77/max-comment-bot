import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeWebAppUrl } from "./normalize-web-app-url";

describe("normalizeWebAppUrl", () => {
  it("lowercases host and drops default https port", () => {
    assert.equal(normalizeWebAppUrl("HTTPS://Example.COM:443/foo"), "https://example.com/foo");
  });

  it("strips trailing slash on root", () => {
    assert.equal(normalizeWebAppUrl("https://commentbot.volkovyskii.ru/"), "https://commentbot.volkovyskii.ru");
  });

  it("strips trailing slash on path", () => {
    assert.equal(normalizeWebAppUrl("https://a.com/miniapp/"), "https://a.com/miniapp");
  });

  it("preserves query on root (no path before ?)", () => {
    assert.equal(normalizeWebAppUrl("https://a.com/?x=1"), "https://a.com?x=1");
  });
});
