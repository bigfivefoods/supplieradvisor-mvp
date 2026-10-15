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

function canvas(size) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const set = (x, y, color) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= size || py >= size) return;
    const i = (py * size + px) * 4;
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
  const fillRect = (x0, y0, x1, y1, color) => {
    const left = Math.floor(Math.min(x0, x1));
    const right = Math.ceil(Math.max(x0, x1));
    const top = Math.floor(Math.min(y0, y1));
    const bottom = Math.ceil(Math.max(y0, y1));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) set(x, y, color);
  };
  const fillEllipse = (cx, cy, rx, ry, color) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, color);
      }
    }
  };
  const fillTri = (ax, ay, bx, by, cx, cy, color) => {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const area = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (rx - px) * (qy - py);
    const whole = area(ax, ay, bx, by, cx, cy);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = area(bx, by, cx, cy, x, y);
        const w1 = area(cx, cy, ax, ay, x, y);
        const w2 = area(ax, ay, bx, by, x, y);
        if (whole >= 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0) set(x, y, color);
      }
    }
  };
  return { rgba, set, fillRect, fillEllipse, fillTri };
}

function draw(size, inset) {
  const { rgba, set } = canvas(size);
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

function drawRole(size, inset, role) {
  const { rgba, fillRect, fillEllipse, fillTri } = canvas(size);
  const x = (u) => inset + u * (size - inset * 2);
  const y = (v) => inset + v * (size - inset * 2);
  if (role === 'owner') {
    fillRect(x(0.16), y(0.28), x(0.84), y(0.4), CYAN);
    fillRect(x(0.22), y(0.38), x(0.78), y(0.86), CYAN);
    for (const [wu, wv] of [[0.3, 0.48], [0.54, 0.48], [0.3, 0.64], [0.54, 0.64]]) {
      fillRect(x(wu), y(wv), x(wu + 0.14), y(wv + 0.1), NAVY);
    }
    fillRect(x(0.44), y(0.7), x(0.56), y(0.86), NAVY);
  } else if (role === 'workers') {
    const cx = size / 2;
    const s = (size - inset * 2) / 2;
    const cy = size / 2;
    fillEllipse(cx, cy + s * 0.42, s * 0.92, s * 0.2, CYAN);
    fillEllipse(cx, cy - s * 0.08, s * 0.58, s * 0.52, CYAN);
    fillRect(cx - s * 0.58, cy + s * 0.08, cx + s * 0.58, cy + s * 0.24, NAVY);
  } else {
    fillTri(x(0.5), y(0.14), x(0.1), y(0.46), x(0.9), y(0.46), CYAN);
    fillRect(x(0.22), y(0.42), x(0.78), y(0.86), CYAN);
    fillRect(x(0.28), y(0.52), x(0.4), y(0.64), NAVY);
    fillRect(x(0.44), y(0.62), x(0.58), y(0.86), NAVY);
  }
  return rgba;
}

const dir = resolve('public/construction');
writeFileSync(resolve(dir, 'icon-192.png'), png(192, 192, draw(192, 18)));
writeFileSync(resolve(dir, 'icon-512.png'), png(512, 512, draw(512, 36)));
writeFileSync(resolve(dir, 'icon-maskable-512.png'), png(512, 512, draw(512, 96)));
writeFileSync(resolve(dir, 'apple-touch-180.png'), png(180, 180, draw(180, 16)));
for (const role of ['owner', 'workers', 'client']) {
  writeFileSync(resolve(dir, `${role}-192.png`), png(192, 192, drawRole(192, 22, role)));
  writeFileSync(resolve(dir, `${role}-512.png`), png(512, 512, drawRole(512, 48, role)));
  writeFileSync(resolve(dir, `${role}-maskable-512.png`), png(512, 512, drawRole(512, 110, role)));
  writeFileSync(resolve(dir, `${role}-apple-180.png`), png(180, 180, drawRole(180, 20, role)));
}
console.log('construction icons written');
