import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PHOTO_BYTES,
  buildPhotoPath,
  isOwnPhotoPath,
  validatePhotoFile,
} from "../../src/lib/storage/progress-photos.ts";

const USER = "6f1c2b9e-3a4d-4c5e-8f70-1a2b3c4d5e6f";

test("validatePhotoFile accepts JPEG/PNG/WebP up to 5 MB", () => {
  assert.deepEqual(validatePhotoFile({ type: "image/webp", size: 300_000 }), { ok: true, mimeType: "image/webp" });
  assert.equal(validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES }).ok, true);
});

test("validatePhotoFile rejects other types, empty and oversized files", () => {
  assert.equal(validatePhotoFile({ type: "image/heic", size: 1000 }).ok, false);
  assert.equal(validatePhotoFile({ type: "image/svg+xml", size: 1000 }).ok, false);
  assert.equal(validatePhotoFile({ type: "application/pdf", size: 1000 }).ok, false);
  assert.equal(validatePhotoFile({ type: "image/png", size: 0 }).ok, false);
  assert.equal(validatePhotoFile({ type: "image/png", size: MAX_PHOTO_BYTES + 1 }).ok, false);
});

test("buildPhotoPath puts files in the owner's folder", () => {
  const path = buildPhotoPath(USER, 4, "side", "image/webp", new Date(1_800_000_000_000));
  assert.equal(path, `${USER}/week-4/side-1800000000000.webp`);
  assert.ok(isOwnPhotoPath(USER, path));
});

test("buildPhotoPath validates inputs", () => {
  assert.throws(() => buildPhotoPath("../etc", 1, "front", "image/jpeg"));
  assert.throws(() => buildPhotoPath(USER, 0, "front", "image/jpeg"));
  assert.throws(() => buildPhotoPath(USER, 13, "front", "image/jpeg"));
  assert.throws(() => buildPhotoPath(USER, 1, "top", "image/jpeg"));
});

test("isOwnPhotoPath rejects other users and traversal", () => {
  assert.equal(isOwnPhotoPath(USER, "someone-else/week-1/front.webp"), false);
  assert.equal(isOwnPhotoPath(USER, `${USER}/../other/front.webp`), false);
});
