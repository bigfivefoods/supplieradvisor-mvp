/**
 * Rasterise public/construction/icon.svg into the PWA PNGs.
 * Node zlib only. No sharp, canvas, or resvg.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAVY = [0x0f, 0x17, 0x2a, 255];
const CYAN = [0x00, 0xb4, 0xd8, 255];

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function draw(size, inset) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = color[3];
  };
  const radius = Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x < radius ? radius - x : x > size - 1 - radius ? x - (size - 1 - radius) : 0;
      const dy = y < radius ? radius - y : y > size - 1 - radius ? y - (size - 1 - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius) set(x, y, NAVY);
    }
  }
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size - inset * 2) / 512;
  const rot = (-28 * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const stamp = (lx, ly, lw, lh) => {
    for (let y = Math.floor(ly); y < ly + lh; y++) {
      for (let x = Math.floor(lx); x < lx + lw; x++) {
        const px = (x - 256) * cos - (y - 256) * sin;
        const py = (x - 256) * sin + (y - 256) * cos;
        set(Math.round(cx + px * scale), Math.round(cy + py * scale), CYAN);
      }
    }
  };
  stamp(228, 106, 56, 250);
  stamp(138, 88, 210, 64);
  return rgba;
}

const dir = resolve('public/construction');
writeFileSync(resolve(dir, 'icon-192.png'), png(192, 192, draw(192, 18)));
writeFileSync(resolve(dir, 'icon-512.png'), png(512, 512, draw(512, 36)));
writeFileSync(resolve(dir, 'icon-maskable-512.png'), png(512, 512, draw(512, 96)));
writeFileSync(resolve(dir, 'apple-touch-180.png'), png(180, 180, draw(180, 16)));
console.log('construction icons written');
