#!/usr/bin/env node
/**
 * Renders RECOMP's existing mark (src/app/icon.svg: deep-purple rounded square
 * with the white "trend up" arrow) to the PNG sizes a PWA needs. Pure Node
 * (zlib) — no image libraries. Anti-aliased with 4×4 supersampling.
 *
 *   public/icons/icon-192.png        (rounded, "any")
 *   public/icons/icon-512.png        (rounded, "any")
 *   public/icons/maskable-512.png    (full-bleed, glyph inside the 80 % safe zone)
 *   public/icons/apple-touch-icon.png (180, full-bleed — iOS rounds it itself)
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const out = path.resolve(import.meta.dirname, "..", "public", "icons");
const BG = [0x4a, 0x31, 0x97]; // accent-700, as in icon.svg
const FG = [0xff, 0xff, 0xff];

// icon.svg geometry (viewBox 64): stroke width 6, round caps/joins.
const STROKES = [
  [[13, 43], [25, 30], [34, 39], [51, 21]],
  [[39, 21], [51, 21], [51, 33]],
];

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inRoundedRect(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/** Sample the mark in viewBox units; glyphScale shrinks the arrow around the centre (maskable). */
function sample(u, v, { rounded, glyphScale }) {
  if (rounded && !inRoundedRect(u, v, 64, 16)) return null;
  const gx = 32 + (u - 32) / glyphScale;
  const gy = 32 + (v - 32) / glyphScale;
  for (const line of STROKES) {
    for (let i = 0; i < line.length - 1; i++) if (distToSegment(gx, gy, line[i], line[i + 1]) <= 3) return FG;
  }
  return BG;
}

function render(size, opts) {
  const SS = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0 + RGBA
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 64;
          const v = ((y + (sy + 0.5) / SS) / size) * 64;
          const c = sample(u, v, opts);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = SS * SS;
      const covered = a / 255;
      row.set(covered ? [Math.round(r / covered), Math.round(g / covered), Math.round(b / covered), Math.round(a / n)] : [0, 0, 0, 0], 1 + x * 4);
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(out, { recursive: true });
const jobs = [
  ["icon-192.png", 192, { rounded: true, glyphScale: 1 }],
  ["icon-512.png", 512, { rounded: true, glyphScale: 1 }],
  ["maskable-512.png", 512, { rounded: false, glyphScale: 0.78 }],
  ["apple-touch-icon.png", 180, { rounded: false, glyphScale: 0.86 }],
];
for (const [name, size, opts] of jobs) {
  const bytes = render(size, opts);
  await writeFile(path.join(out, name), bytes);
  console.log(`✓ public/icons/${name} (${size}×${size}, ${(bytes.length / 1024).toFixed(1)} KB)`);
}

// Paths browsers request on their own (iOS asks for these at the root).
const pub = path.resolve(out, "..");
const apple = render(180, { rounded: false, glyphScale: 0.86 });
for (const name of ["apple-touch-icon.png", "apple-touch-icon-precomposed.png"]) {
  await writeFile(path.join(pub, name), apple);
  console.log(`✓ public/${name}`);
}
// favicon.ico with an embedded 48×48 PNG (supported by every current browser).
const fav = render(48, { rounded: true, glyphScale: 1 });
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // icon
header.writeUInt16LE(1, 4); // one image
header[6] = 48; header[7] = 48; header[8] = 0; header[9] = 0;
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bpp
header.writeUInt32LE(fav.length, 14);
header.writeUInt32LE(22, 18); // offset
await writeFile(path.join(pub, "favicon.ico"), Buffer.concat([header, fav]));
console.log("✓ public/favicon.ico (48×48)");
