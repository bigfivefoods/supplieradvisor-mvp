/**
 * Smoke: MODULE_NAV order + step preservation via functional nav.
 * Run: node scripts/check-module-nav-integrity.mjs
 * (Uses dynamic import of compiled esbuild bundle or inline parse.)
 */
import { createRequire } from 'module';
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const outdir = '/tmp/sa-module-integrity';
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: ['lib/chrome/module-nav-integrity.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: join(outdir, 'integrity.cjs'),
  packages: 'external',
  // Bundle workspace internals
  packages: undefined,
  external: [],
  alias: {
    '@': process.cwd(),
  },
});

const require = createRequire(import.meta.url);
// re-build with absolute alias
await build({
  entryPoints: [join(process.cwd(), 'lib/chrome/module-nav-integrity.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: join(outdir, 'integrity.cjs'),
  plugins: [
    {
      name: 'alias-at',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: join(process.cwd(), args.path.slice(2)),
        }));
      },
    },
  ],
});

const { auditModuleNavIntegrity } = require(join(outdir, 'integrity.cjs'));
const report = auditModuleNavIntegrity();
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error('FAIL: module feature trees incomplete');
  process.exit(1);
}
console.log(
  `OK: ${report.moduleCount} modules, ${report.stepCount} steps preserved`
);
