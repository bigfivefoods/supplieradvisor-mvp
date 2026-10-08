/**
 * Run: npx --yes tsx lib/fitness/vuka-member-seed.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseVukaMemberSeed } from './vuka-member-seed';

const examplePath = resolve('scripts/fixtures/vuka-member-seed.example.json');
const example = JSON.parse(readFileSync(examplePath, 'utf8')) as {
  example?: boolean;
  submissions?: unknown[];
};
assert.equal(example.example, true);
assert.throws(() => parseVukaMemberSeed(example), /example/i);

const parsed = parseVukaMemberSeed({
  import_version: '2026-08-19',
  submissions: [
    {
      kind: 'group',
      name: 'Alex Example',
      email: 'alex.example@example.test',
      id_number: '0001015009086',
    },
    { kind: 'group', name: '' },
  ],
  roster: [{ name: 'Alex Example', amount_zar: 10, class_hint: 'BC' }],
  name_folds: [{ aliases: ['alex samples'], canonical: 'Alex Example' }],
  coaches: [
    {
      name: 'Jordan Example',
      email: 'Jordan.Coach@example.test',
      code: 'JOR',
      avoid_name: 'decoy',
    },
  ],
});
assert.equal(parsed.importVersion, '2026-08-19-bank');
assert.equal(parsed.submissions.length, 1);
assert.equal(parsed.roster.length, 1);
assert.equal(parsed.nameFolds.length, 1);
assert.equal(parsed.coaches[0]?.email, 'jordan.coach@example.test');

assert.equal(existsSync(resolve('lib/fitness/vuka-contracts.generated.json')), false);

const gitignore = readFileSync(resolve('.gitignore'), 'utf8');
assert.match(gitignore, /data\/private\//);

const watched = [
  'lib/fitness/vuka-roster.ts',
  'lib/fitness/vuka-class-catalog.ts',
  'lib/fitness/merge-fit-clients.ts',
  'lib/fitness/vuka-member-seed.ts',
  'lib/fitness/vuka-member-seed-server.ts',
  'lib/fitness/gym-shop.ts',
];
for (const file of watched) {
  const text = readFileSync(resolve(file), 'utf8');
  assert.equal(text.includes('vuka-contracts.generated'), false, file);
  assert.equal(text.includes('@gmail.com'), false, file);
  assert.equal(text.includes('www.jotform.com'), false, file);
}

const server = readFileSync(
  resolve('lib/fitness/vuka-member-seed-server.ts'),
  'utf8'
);
assert.match(server, /gym_member_seeds/);
assert.match(server, /company_id/);
const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
assert.match(route, /loadVukaMemberSeed/);
assert.match(route, /vuka-member-seed-server/);
const clientPages = [
  'app/dashboard/fitgraph/clients/page.tsx',
  'app/dashboard/fitgraph/classes/page.tsx',
  'app/dashboard/fitgraph/calendar/page.tsx',
  'components/fitness/MemberAllocateTable.tsx',
];
for (const file of clientPages) {
  const text = readFileSync(resolve(file), 'utf8');
  assert.equal(text.includes('vuka-member-seed-server'), false, file);
  assert.equal(text.includes('vuka-contracts.generated'), false, file);
}

console.log('vuka-member-seed.test.ts ok');
