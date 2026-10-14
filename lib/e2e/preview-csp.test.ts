/**
 * Preview smoke may ignore the Vercel toolbar CSP hit, and nothing else.
 * Run: npx --yes tsx lib/e2e/preview-csp.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  enforcedCspViolations,
  isVercelPreviewBase,
  isVercelToolbarScript,
} from './preview-csp';

const toolbar = 'https://vercel.live/_next-live/feedback/feedback.js';
const preview = 'https://supplieradvisor-feow7lf2g-bigfivefoods-projects.vercel.app';
const production = 'https://www.supplieradvisor.com';

assert.equal(isVercelPreviewBase(preview), true);
assert.equal(isVercelPreviewBase('https://foo.bar.vercel.app/path'), true);
assert.equal(isVercelPreviewBase(production), false);
assert.equal(isVercelPreviewBase('https://vercel.app'), false);
assert.equal(isVercelPreviewBase('https://notvercel.app'), false);
assert.equal(isVercelPreviewBase('https://evil.vercel.app.attacker.com'), false);
assert.equal(isVercelPreviewBase('not a url'), false);

assert.equal(isVercelToolbarScript(toolbar), true);
assert.equal(isVercelToolbarScript(`${toolbar}?dpl=1`), true);
assert.equal(isVercelToolbarScript('https://vercel.live/other.js'), false);
assert.equal(isVercelToolbarScript('https://assets.vercel.com/_next-live/feedback/feedback.js'), false);
assert.equal(
  isVercelToolbarScript('https://evil.example/_next-live/feedback/feedback.js'),
  false
);
assert.equal(
  isVercelToolbarScript('https://vercel.live.evil.com/_next-live/feedback/feedback.js'),
  false
);

const hit = { directive: 'script-src-elem', blocked: toolbar };

assert.deepEqual(
  enforcedCspViolations([hit], { hostname: 'supplieradvisor-feow7lf2g-bigfivefoods-projects.vercel.app', baseUrl: preview }),
  []
);

assert.deepEqual(
  enforcedCspViolations([hit], { hostname: 'www.supplieradvisor.com', baseUrl: production }),
  [hit]
);

const other = { directive: 'script-src-elem', blocked: 'https://evil.example/app.js' };
assert.deepEqual(
  enforcedCspViolations([hit, other], { hostname: 'x.vercel.app', baseUrl: preview }),
  [other]
);

const localEval = { directive: 'script-src', blocked: 'eval' };
assert.deepEqual(
  enforcedCspViolations([localEval, hit], { hostname: 'localhost', baseUrl: 'http://localhost:3000' }),
  [hit]
);
assert.deepEqual(
  enforcedCspViolations([localEval], { hostname: 'www.supplieradvisor.com', baseUrl: production }),
  [localEval]
);

const spec = readFileSync(resolve('e2e/golden-path-smoke.spec.ts'), 'utf8');
const directoryAt = spec.indexOf("test('retired directory redirects home'");
assert.ok(directoryAt >= 0);
const directory = spec.slice(directoryAt, directoryAt + 600);
assert.match(directory, /maxRedirects: 0/);
assert.match(directory, /loc === '\/' \|\| loc\.endsWith\('\/'\) \|\| loc\.includes\(base\)/);

console.log('preview-csp.test.ts ok');
