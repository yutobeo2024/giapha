import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILD_ID, canReloadNow, displayVersion, isNewBuild } from "./buildVersion.ts";

test("ngoài Vite thì bản là dev", () => {
  assert.equal(BUILD_ID, "dev");
});

test("displayVersion: tách version và commit", () => {
  assert.equal(displayVersion("1.1.0+a3cc60b"), "1.1.0 (a3cc60b)");
  assert.equal(displayVersion("1.1.0+a3cc60b-202610171230"), "1.1.0 (a3cc60b-202610171230)");
  assert.equal(displayVersion("dev"), "dev");
});

test("isNewBuild: chỉ khi server trả build khác và hợp lệ", () => {
  assert.equal(isNewBuild("1.1.0+a", { build: "1.1.0+b" }), true);
  assert.equal(isNewBuild("1.1.0+a", { build: "1.1.0+a" }), false);
  assert.equal(isNewBuild("1.1.0+a", { build: "" }), false);
  assert.equal(isNewBuild("1.1.0+a", { build: 5 }), false);
  assert.equal(isNewBuild("1.1.0+a", {}), false);
  assert.equal(isNewBuild("1.1.0+a", null), false);
  assert.equal(isNewBuild("1.1.0+a", "<html>"), false);
});

test("canReloadNow: trang quản trị thì chờ chuyển mục", () => {
  assert.equal(canReloadNow("/tree"), true);
  assert.equal(canReloadNow("/"), true);
  assert.equal(canReloadNow("/admin"), false);
  assert.equal(canReloadNow("/admin/anything"), false);
});
