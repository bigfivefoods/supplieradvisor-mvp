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
  collectNextScriptHashes,
  patchHashPlaceholder,
} = require('../lib/security/inline-script-hashes');

const TOKEN = '__CSP_HASH_MAP__';
const ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = path.join(ROOT, '.next');
const SERVER_DIR = path.join(NEXT_DIR, 'server');

function countHtml(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) count += 1;
    }
  };
  visit(dir);
  return count;
}

function main() {
  if (!fs.existsSync(SERVER_DIR)) {
    console.error(`CSP hash patch: missing ${SERVER_DIR}`);
    process.exit(1);
  }

  const map = collectNextScriptHashes(NEXT_DIR);
  const routes = Object.keys(map);
  if (!routes.length) {
    const appHtml = countHtml(path.join(SERVER_DIR, 'app'));
    const cacheHtml = countHtml(path.join(SERVER_DIR, 'route-cache'));
    console.error(
      `CSP hash patch: no prerendered inline scripts were found (app html ${appHtml}, route-cache html ${cacheHtml})`
    );
    process.exit(1);
  }
  if (!map['/'] || !map['/login']) {
    const sample = routes.slice(0, 12).join(', ') || '(none)';
    console.error(`CSP hash patch: home and login hashes are required (sample routes: ${sample})`);
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
