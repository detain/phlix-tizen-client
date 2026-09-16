/**
 * Deterministic widget icon generator (T-03).
 *
 * `app/config.xml` declares `<icon src="icon.png"/>`, but no such file existed
 * in the repo — so a real Tizen Studio / `tizen package -t wgt` build either
 * warns or drops a broken-icon tile onto the TV home screen.
 *
 * This script writes a 128×128 `app/icon.png`: a deep "nocturne" rounded panel
 * carrying a centred right-pointing play mark. It is a hand-built PNG (no canvas
 * / image library) so the asset is fully reproducible from source — the bytes
 * depend only on this file, never on a toolchain version or a timestamp.
 *
 * Run via `node scripts/make-icon.js`. Output is committed; the generator is
 * kept so the artifact's provenance is auditable and it can be regenerated.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'app', 'icon.png');

const SIZE = 128;
const CORNER_RADIUS = 24;

// Nocturne panel + warm play mark — brand-safe generic geometry, no third-party logo.
const BG = { r: 27, g: 24, b: 48, a: 255 }; // #1B1830
const MARK = { r: 242, g: 193, b: 78, a: 255 }; // #F2C14E
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

/** True when (x,y) lies inside the rounded-square widget tile. */
function insideRoundedSquare(x, y) {
  const r = CORNER_RADIUS;
  if (x < r || y < r || x > SIZE - 1 - r || y > SIZE - 1 - r) {
    const cx = x < r ? r : SIZE - 1 - r;
    const cy = y < r ? r : SIZE - 1 - r;
    const dx = x - cx;
    const dy = y - cy;
    // Only the corner quadrants are clipped; interior points pass.
    if ((x < r || x > SIZE - 1 - r) && (y < r || y > SIZE - 1 - r)) {
      return dx * dx + dy * dy <= r * r;
    }
  }
  return true;
}

/** Barycentric sign test for a right-pointing play triangle. */
function insidePlayMark(x, y) {
  const ax = 50, ay = 42;
  const bx = 50, by = 86;
  const cx = 92, cy = 64;
  const sign = (px, py, qx, qy, rx, ry) =>
    (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = sign(x, y, ax, ay, bx, by);
  const d2 = sign(x, y, bx, by, cx, cy);
  const d3 = sign(x, y, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function pixelAt(x, y) {
  if (!insideRoundedSquare(x, y)) return TRANSPARENT;
  if (insidePlayMark(x, y)) return MARK;
  return BG;
}

/** Raw scanline data: each row is one filter byte (0 = None) + RGBA pixels. */
function buildRawScanlines() {
  const bytes = new Uint8Array(SIZE * (1 + SIZE * 4));
  let i = 0;
  for (let y = 0; y < SIZE; y++) {
    bytes[i++] = 0; // filter type 0
    for (let x = 0; x < SIZE; x++) {
      const p = pixelAt(x, y);
      bytes[i++] = p.r;
      bytes[i++] = p.g;
      bytes[i++] = p.b;
      bytes[i++] = p.a;
    }
  }
  return bytes;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) c = CRC_TABLE[c ^ buf[n]] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function buildPng() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); // width
  ihdr.writeUInt32BE(SIZE, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type 6 = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(buildRawScanlines(), { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(outPath, buildPng());
console.log(`Wrote ${SIZE}x${SIZE} icon -> ${outPath}`);
