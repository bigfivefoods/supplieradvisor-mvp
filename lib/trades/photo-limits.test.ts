/**
 * Run: npx --yes tsx lib/trades/photo-limits.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TRADE_PHOTO_EDGE_STEPS,
  TRADE_PHOTO_MAX_CHARS,
  TRADE_PHOTO_MAX_COUNT,
  TRADE_PHOTO_MAX_EDGE,
  TRADE_PHOTO_MAX_FILE_BYTES,
  TRADE_PHOTO_QUALITIES,
} from './photo-limits';

assert.equal(TRADE_PHOTO_MAX_EDGE, 1280);
assert.ok(TRADE_PHOTO_EDGE_STEPS[0] === TRADE_PHOTO_MAX_EDGE);
assert.ok(TRADE_PHOTO_EDGE_STEPS.every((edge) => edge <= 1600 && edge >= 640));
assert.ok(TRADE_PHOTO_QUALITIES[0]! <= 0.8 && TRADE_PHOTO_QUALITIES[0]! >= 0.65);
assert.ok(TRADE_PHOTO_QUALITIES.every((quality) => quality >= 0.45 && quality <= 0.85));
assert.equal(TRADE_PHOTO_MAX_CHARS, 400_000);
assert.equal(TRADE_PHOTO_MAX_COUNT, 3);
assert.ok(TRADE_PHOTO_MAX_FILE_BYTES <= 15_000_000);

const sql = readFileSync(resolve('supabase/migrations/20261014_tradegraph.sql'), 'utf8');
assert.match(sql, /length\(v_photo\) > 400000/);
assert.match(sql, /jsonb_array_length\(v_photos\) > 3/);

const client = readFileSync(resolve('components/trades/photo.ts'), 'utf8');
assert.match(client, /TRADE_PHOTO_EDGE_STEPS/);
assert.match(client, /TRADE_PHOTO_QUALITIES/);
assert.match(client, /image\/jpeg/);

console.log('photo-limits.test.ts ok');
