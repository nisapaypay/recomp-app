import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesRoute, safeNextPath } from "../../src/lib/auth/redirect.ts";

test("safeNextPath keeps same-origin app paths", () => {
  assert.equal(safeNextPath("/walking"), "/walking");
  assert.equal(safeNextPath("/progress?week=4"), "/progress?week=4");
});

test("safeNextPath blocks open redirects and junk", () => {
  for (const bad of [null, undefined, "", "walking", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)"]) {
    assert.equal(safeNextPath(bad), "/dashboard", String(bad));
  }
});

test("safeNextPath never returns to public auth pages", () => {
  assert.equal(safeNextPath("/login"), "/dashboard");
  assert.equal(safeNextPath("/login?next=/x"), "/dashboard");
  assert.equal(safeNextPath("/auth/callback"), "/dashboard");
});

test("matchesRoute matches exact and nested paths only", () => {
  assert.ok(matchesRoute("/login", ["/login"]));
  assert.ok(matchesRoute("/auth/callback/x", ["/auth/callback"]));
  assert.ok(!matchesRoute("/login-help", ["/login"]));
  assert.ok(!matchesRoute("/dashboard", ["/login"]));
});
