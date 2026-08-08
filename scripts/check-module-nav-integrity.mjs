/**
 * Smoke: MODULE_NAV feature trees preserved by functional nav.
 * Run: yarn check:module-nav
 */
import { build } from 'esbuild';
import { createRequire } from 'module';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const outdir = '/tmp/sa-module-integrity';
mkdirSync(outdir, { recursive: true });
const outfile = join(outdir, 'integrity.cjs');
const root = process.cwd();

function resolveAt(path) {
  const base = join(root, path.slice(2));
  for (const ext of ['', '.ts', '.tsx', '.js']) {
    const p = base + ext;
    if (existsSync(p)) return p;
  }
  return base + '.ts';
}

await build({
  entryPoints: [join(root, 'lib/chrome/module-nav-integrity.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  plugins: [
    {
      name: 'alias-at',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveAt(args.path),
        }));
      },
    },
  ],
});

const require = createRequire(import.meta.url);
const { auditModuleNavIntegrity } = require(outfile);
const report = auditModuleNavIntegrity();
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error('FAIL: module feature trees incomplete');
  process.exit(1);
}
console.log(
  `OK: ${report.moduleCount} modules, ${report.stepCount} steps preserved`
);
