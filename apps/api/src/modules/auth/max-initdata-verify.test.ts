import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MaxInitDataValidationError,
  parseAndVerifyMaxInitData
} from "./max-initdata-verify";

const FIXTURE_TOKEN = "test_max_bot_token_fixture";
/** Raw initData shape; hash computed for FIXTURE_TOKEN via MAX WebAppData algorithm. */
const FIXTURE_INIT_DATA =
  "auth_date=1111111111&start_param=post_fixture&user=%7B%22id%22%3A%2242%22%2C%22first_name%22%3A%22A%22%7D&hash=b282233368dc6eaf29889dd547e7a3d3cc755bf317a9ca984324572b298d1114";

describe("parseAndVerifyMaxInitData", () => {
  it("accepts valid initData", () => {
    const p = parseAndVerifyMaxInitData(FIXTURE_INIT_DATA, FIXTURE_TOKEN);
    assert.equal(p.user.id, "42");
    assert.equal(p.user.first_name, "A");
    assert.equal(p.start_param, "post_fixture");
  });

  it("rejects when hash is missing", () => {
    assert.throws(
      () => parseAndVerifyMaxInitData("auth_date=1&user=%7B%22id%22%3A%221%22%7D", FIXTURE_TOKEN),
      (e: unknown) =>
        e instanceof MaxInitDataValidationError && e.statusCode === 400 && (e as Error).message === "hash is missing"
    );
  });

  it("rejects when hash appears more than once", () => {
    assert.throws(
      () =>
        parseAndVerifyMaxInitData(
          `${FIXTURE_INIT_DATA}&hash=deadbeef`,
          FIXTURE_TOKEN
        ),
      (e: unknown) =>
        e instanceof MaxInitDataValidationError &&
        e.statusCode === 400 &&
        (e as Error).message === "hash must appear exactly once"
    );
  });

  it("rejects when a field is tampered (hash mismatch)", () => {
    const bad = FIXTURE_INIT_DATA.replace("1111111111", "1111111112");
    assert.throws(
      () => parseAndVerifyMaxInitData(bad, FIXTURE_TOKEN),
      (e: unknown) =>
        e instanceof MaxInitDataValidationError &&
        e.statusCode === 401 &&
        (e as Error).message === "initData hash mismatch"
    );
  });
});
