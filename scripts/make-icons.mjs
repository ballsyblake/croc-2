// Generates the PWA icons (pure Node, no dependencies): Bimble's face on a dark tile.
// Usage: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Chunky 32x32 "pixel art" sampled with nearest-neighbour for a PS1-ish icon.
function face(u, v) {
  const px = Math.floor(u * 32) + 0.5, py = Math.floor(v * 32) + 0.5;
  const d = (cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
  const bg = [27, 23, 48];
  // Ears
  if (d(10, 8, 2.6, 7) < 1 || d(22, 8, 2.6, 7) < 1) return d(10, 8, 1.2, 5) < 1 || d(22, 8, 1.2, 5) < 1 ? [242, 135, 155] : [63, 193, 176];
  // Scarf
  if (py > 25 && py < 28 && Math.abs(px - 16) < 10) return [240, 138, 44];
  // Head
  if (d(16, 18, 11, 10) < 1) {
    if (d(12, 17, 2.2, 3) < 1) return d(12.5, 17.5, 1.1, 1.6) < 1 ? [21, 21, 32] : [255, 255, 255];
    if (d(20, 17, 2.2, 3) < 1) return d(20.5, 17.5, 1.1, 1.6) < 1 ? [21, 21, 32] : [255, 255, 255];
    if (d(16, 21, 1.3, 1) < 1) return [242, 135, 155];
    if (d(16, 23.5, 6, 3.5) < 1) return [243, 230, 196];
    return [63, 193, 176];
  }
  return bg;
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, png(size, face));
}
console.log('icons written');
