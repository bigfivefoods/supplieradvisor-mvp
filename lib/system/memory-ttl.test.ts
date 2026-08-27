/**
 * Run: npx --yes tsx lib/system/memory-ttl.test.ts
 */
import assert from 'node:assert/strict';
import { ttlDel, ttlGet, ttlGetOrLoad, ttlSet } from './memory-ttl';

async function main() {
  ttlDel('ttl-test');
  ttlSet('ttl-test:a', { n: 1 }, 60_000);
  assert.deepEqual(ttlGet('ttl-test:a'), { n: 1 });
  ttlDel('ttl-test:a');
  assert.equal(ttlGet('ttl-test:a'), null);

  let loads = 0;
  const p1 = ttlGetOrLoad('ttl-test:sf', 60_000, async () => {
    loads += 1;
    await new Promise((r) => setTimeout(r, 20));
    return { ok: true, loads };
  });
  const p2 = ttlGetOrLoad('ttl-test:sf', 60_000, async () => {
    loads += 1;
    return { ok: false, loads };
  });
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(loads, 1);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);

  const cached = await ttlGetOrLoad('ttl-test:sf', 60_000, async () => {
    loads += 1;
    return { ok: false, loads };
  });
  assert.equal(loads, 1);
  assert.equal(cached.ok, true);

  ttlDel('ttl-test');
  console.log('memory-ttl tests ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
