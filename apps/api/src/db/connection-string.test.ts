import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  redactDatabaseUrl,
  targetDatabaseNameFromUrl,
  tcpEndpointFromConnectionString,
  withDatabaseName
} from "./connection-string";

describe("connection-string helpers", () => {
  it("targetDatabaseNameFromUrl reads name before query string", () => {
    assert.equal(
      targetDatabaseNameFromUrl("postgresql://postgres:postgres@127.0.0.1:5432/comments?schema=public"),
      "comments"
    );
  });

  it("withDatabaseName swaps database segment and keeps query string", () => {
    const u = "postgresql://postgres:postgres@127.0.0.1:5432/comments?schema=public";
    assert.equal(
      withDatabaseName(u, "postgres"),
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public"
    );
  });

  it("targetDatabaseNameFromUrl decodes encoded database segment", () => {
    assert.equal(targetDatabaseNameFromUrl("postgresql://u:p@h:5432/my%2Ddb"), "my-db");
  });

  it("tcpEndpointFromConnectionString reads host port database", () => {
    assert.deepEqual(
      tcpEndpointFromConnectionString("postgresql://postgres:postgres@127.0.0.1:5432/comments?schema=public"),
      { host: "127.0.0.1", port: 5432, database: "comments" }
    );
    assert.deepEqual(tcpEndpointFromConnectionString("postgresql://u:p@db.internal:5432/appdb"), {
      host: "db.internal",
      port: 5432,
      database: "appdb"
    });
    assert.deepEqual(tcpEndpointFromConnectionString("postgresql://u:p@localhost/mydb"), {
      host: "localhost",
      port: 5432,
      database: "mydb"
    });
  });

  it("redactDatabaseUrl masks password", () => {
    const r = redactDatabaseUrl("postgresql://postgres:secret@127.0.0.1:5432/comments?schema=public");
    assert.match(r, /postgresql:\/\/postgres:\*\*\*@/);
    assert.ok(!r.includes("secret"));
  });
});
