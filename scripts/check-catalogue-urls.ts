/**
 * HEAD-check every available catalogue on the public Blob store.
 * Run: npx --yes tsx scripts/check-catalogue-urls.ts
 * Network by design. Not part of typecheck.yml.
 */
import assert from 'node:assert/strict';
import { availableCatalogues, catalogueFileUrl } from '@/lib/catalogues';

async function head(url: string) {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  return response;
}

function header(response: Response, name: string) {
  return (response.headers.get(name) || '').trim();
}

async function main() {
  let failed = 0;

  for (const entry of availableCatalogues()) {
    const file = entry.file;
    if (!file) {
      console.error(`${entry.id}: available entry has no file`);
      failed += 1;
      continue;
    }
    const url = catalogueFileUrl(entry);
    const direct = await head(url);
    const type = header(direct, 'content-type');
    const length = header(direct, 'content-length');
    const download = await head(`${url}?download=1`);
    const disposition = header(download, 'content-disposition');
    console.log(
      [
        file.name,
        `status=${direct.status}`,
        `type=${type || 'missing'}`,
        `length=${length || 'missing'}`,
        `expected=${file.bytes}`,
        `download=${download.status}`,
        `disposition=${disposition || 'missing'}`,
      ].join(' ')
    );
    try {
      assert.equal(direct.status, 200, `${file.name} status`);
      assert.match(type.toLowerCase(), /^application\/pdf\b/, `${file.name} content-type`);
      assert.equal(Number(length), file.bytes, `${file.name} content-length`);
      assert.equal(download.status, 200, `${file.name} download status`);
      assert.match(disposition.toLowerCase(), /attachment/, `${file.name} content-disposition`);
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failed > 0) {
    console.error(`check:catalogues failed (${failed})`);
    process.exit(1);
  }

  console.log('check:catalogues ok');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
