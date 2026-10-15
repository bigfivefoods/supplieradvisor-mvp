/**
 * In-repo QR Code Model 2 encoder (byte mode, ECC M, versions 1–7).
 * No package dependency. Mask is chosen for a stable, lower-penalty pattern.
 */

/** Single-group ECC M: blocks, data codewords per block, ECC per block. */
const ECC_BLOCKS: Array<[number, number, number]> = [
  [1, 16, 10],
  [1, 28, 16],
  [1, 44, 26],
  [2, 32, 18],
  [2, 43, 22],
  [4, 27, 16],
  [4, 31, 18],
];

const ALIGNMENT: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26, 46],
  [6, 30, 54],
  [6, 34, 58],
  [6, 22, 38],
];

function sizeFor(version: number) {
  return 17 + 4 * version;
}

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function mul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function makeGenerator(degree: number): number[] {
  const generator = new Array(degree).fill(0);
  generator[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      generator[j] = mul(generator[j], root);
      if (j + 1 < degree) generator[j] ^= generator[j + 1];
    }
    root = mul(root, 2);
  }
  return generator;
}

function rsRemainder(data: number[], eccLen: number): number[] {
  const generator = makeGenerator(eccLen);
  const out = new Array(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.copyWithin(0, 1);
    out[eccLen - 1] = 0;
    for (let i = 0; i < eccLen; i++) out[i] ^= mul(generator[i], factor);
  }
  return out;
}

function interleave(blocks: number[][], ecc: number[][]): number[] {
  const out: number[] = [];
  const dataLen = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < dataLen; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  const eccLen = ecc[0]?.length || 0;
  for (let i = 0; i < eccLen; i++) {
    for (const block of ecc) out.push(block[i]);
  }
  return out;
}

function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let b = 0; b < 8; b++) value = (value << 1) | (bits[i + b] || 0);
    bytes.push(value);
  }
  return bytes;
}

function pushBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function dataCodewords(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const [, perBlock, ] = ECC_BLOCKS[version - 1];
  const blocks = ECC_BLOCKS[version - 1][0];
  const dataLen = perBlock * blocks;
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  for (const byte of bytes) pushBits(bits, byte, 8);
  const capacity = dataLen * 8;
  const terminator = Math.min(4, capacity - bits.length);
  if (terminator > 0) pushBits(bits, 0, terminator);
  while (bits.length % 8) bits.push(0);
  const data = bitsToBytes(bits);
  const pads = [0xec, 0x11];
  let pad = 0;
  while (data.length < dataLen) data.push(pads[pad++ % 2]);
  return data.slice(0, dataLen);
}

function fits(text: string, version: number) {
  const bytes = new TextEncoder().encode(text).length;
  const [blocks, perBlock] = ECC_BLOCKS[version - 1];
  return 4 + 8 + bytes * 8 <= perBlock * blocks * 8;
}

function functionModules(version: number): { modules: Uint8Array; reserved: Uint8Array } {
  const n = sizeFor(version);
  const modules = new Uint8Array(n * n);
  const reserved = new Uint8Array(n * n);
  const set = (x: number, y: number, dark: boolean, hold = true) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    modules[y * n + x] = dark ? 1 : 0;
    if (hold) reserved[y * n + x] = 1;
  };
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const on = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        set(ox + x, oy + y, on);
      }
    }
  };
  finder(0, 0);
  finder(n - 7, 0);
  finder(0, n - 7);
  for (let i = 8; i < n - 8; i++) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }
  const centers = ALIGNMENT[version] || [];
  for (const cx of centers) {
    for (const cy of centers) {
      if (reserved[cy * n + cx]) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const on = Math.max(Math.abs(x), Math.abs(y)) !== 1;
          set(cx + x, cy + y, on);
        }
      }
    }
  }
  set(8, 4 * version + 9, true);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1F25);
    const bits = ((version << 12) | (rem & 0xfff)) >>> 0;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  for (let i = 0; i < 8; i++) {
    set(8, i, false);
    set(i, 8, false);
    set(8, n - 1 - i, false);
    set(n - 1 - i, 8, false);
  }
  set(8, 8, false);
  return { modules, reserved };
}

const FORMAT_MASK = 0x5412;

function formatBits(ecc: number, mask: number) {
  let data = (ecc << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (((rem >>> i) & 1) !== 0) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ FORMAT_MASK;
}

function applyFormat(modules: Uint8Array, n: number, mask: number) {
  const bits = formatBits(0, mask);
  const coords: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i++) coords.push([8, i]);
  coords.push([8, 7], [8, 8], [7, 8]);
  for (let i = 5; i >= 0; i--) coords.push([i, 8]);
  for (let i = 0; i < 7; i++) coords.push([n - 1 - i, 8]);
  for (let i = 0; i < 8; i++) coords.push([8, n - 8 + i]);
  coords.forEach(([x, y], index) => {
    const dark = ((bits >>> (14 - index)) & 1) === 1;
    modules[y * n + x] = dark ? 1 : 0;
  });
}

function maskBit(mask: number, x: number, y: number) {
  if (mask === 0) return (x + y) % 2 === 0;
  if (mask === 1) return y % 2 === 0;
  if (mask === 2) return x % 3 === 0;
  if (mask === 3) return (x + y) % 3 === 0;
  if (mask === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
  if (mask === 5) return ((x * y) % 2) + ((x * y) % 3) === 0;
  if (mask === 6) return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
  return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
}

function placeData(modules: Uint8Array, reserved: Uint8Array, n: number, codewords: number[], mask: number) {
  const bits: number[] = [];
  for (const byte of codewords) pushBits(bits, byte, 8);
  let i = 0;
  let upward = true;
  for (let x = n - 1; x > 0; x -= 2) {
    if (x === 6) x--;
    for (let row = 0; row < n; row++) {
      const y = upward ? n - 1 - row : row;
      for (const dx of [0, -1]) {
        const xx = x + dx;
        if (reserved[y * n + xx]) continue;
        const dark = i < bits.length ? bits[i] === 1 : false;
        const flip = maskBit(mask, xx, y);
        modules[y * n + xx] = dark !== flip ? 1 : 0;
        i++;
      }
    }
    upward = !upward;
  }
}

function penalty(modules: Uint8Array, n: number) {
  let score = 0;
  const at = (x: number, y: number) => modules[y * n + x];
  for (let y = 0; y < n; y++) {
    let run = 1;
    for (let x = 1; x < n; x++) {
      if (at(x, y) === at(x - 1, y)) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  let dark = 0;
  for (let i = 0; i < modules.length; i++) dark += modules[i];
  score += Math.abs(Math.floor((dark * 100) / modules.length) - 50) * 2;
  return score;
}

export type QrMatrix = { size: number; modules: number[][] };

export function qrMatrix(text: string): QrMatrix {
  const value = String(text || ' ');
  let version = 1;
  while (version < ECC_BLOCKS.length && !fits(value, version)) version++;
  if (!fits(value, version)) throw new Error('Link is too long for the in-repo QR');
  const [blocks, perBlock, eccLen] = ECC_BLOCKS[version - 1];
  const data = dataCodewords(value, version);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  for (let i = 0; i < blocks; i++) {
    const slice = data.slice(i * perBlock, (i + 1) * perBlock);
    dataBlocks.push(slice);
    eccBlocks.push(rsRemainder(slice, eccLen));
  }
  const codewords = interleave(dataBlocks, eccBlocks);
  const n = sizeFor(version);
  let best: Uint8Array | null = null;
  let bestScore = Infinity;
  let bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    const base = functionModules(version);
    placeData(base.modules, base.reserved, n, codewords, mask);
    applyFormat(base.modules, n, mask);
    const score = penalty(base.modules, n);
    if (score < bestScore) {
      bestScore = score;
      best = base.modules;
      bestMask = mask;
    }
  }
  void bestMask;
  const modules: number[][] = [];
  for (let y = 0; y < n; y++) {
    modules.push(Array.from(best!.slice(y * n, y * n + n)));
  }
  return { size: n, modules };
}

export function qrSvg(text: string): string {
  const matrix = qrMatrix(text);
  const quiet = 2;
  const cells: string[] = [];
  matrix.modules.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) cells.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
    });
  });
  const dim = matrix.size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">${cells.join('')}</svg>`;
}
