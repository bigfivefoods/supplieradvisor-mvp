/**
 * After `next build`, hash prerendered inline scripts and write them into
 * the middleware bundle. Cached HTML has no per-request nonce, so its
 * script-src allowlist is these hashes.
 *
 * Run: node scripts/patch-csp-script-hashes.js
 */
const fs = require('fs');
const path = require('path');
const {
  collectInlineScriptHashes,
  patchHashPlaceholder,
} = require('../lib/security/inline-script-hashes');

const TOKEN = '__CSP_HASH_MAP__';
const ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = path.join(ROOT, '.next');
const APP_DIR = path.join(NEXT_DIR, 'server', 'app');

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error(`CSP hash patch: missing ${APP_DIR}`);
    process.exit(1);
  }

  const map = collectInlineScriptHashes(APP_DIR);
  const routes = Object.keys(map);
  if (!routes.length) {
    console.error('CSP hash patch: no prerendered inline scripts were found');
    process.exit(1);
  }
  if (!map['/'] || !map['/login']) {
    console.error('CSP hash patch: home and login hashes are required');
    process.exit(1);
  }

  let files = 0;
  let replacements = 0;
  try {
    ({ files, replacements } = patchHashPlaceholder(NEXT_DIR, map));
  } catch (error) {
    console.error(`CSP hash patch: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  if (!files) {
    console.error(`CSP hash patch: ${TOKEN} was not present in the Next build`);
    process.exit(1);
  }

  console.log(
    `CSP hash patch: ${routes.length} routes, ${replacements} placeholder${
      replacements === 1 ? '' : 's'
    } in ${files} file${files === 1 ? '' : 's'}`
  );
}

main();
