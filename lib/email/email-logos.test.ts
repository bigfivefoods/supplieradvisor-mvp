/**
 * Run: npx --yes tsx lib/email/email-logos.test.ts
 */
import assert from 'node:assert/strict';
import {
  emailContainLogo,
  emailSaWordmark,
  isSaWordmarkSrc,
  unstretchEmailLogos,
} from './email-logos';

assert.equal(isSaWordmarkSrc('https://www.supplieradvisor.com/sa-logo.png'), true);
assert.equal(isSaWordmarkSrc('/sa-logo-tick.png'), false);

const mark = emailSaWordmark({
  src: 'https://www.supplieradvisor.com/sa-logo.png',
  height: 36,
});
assert.match(mark, /width="83"/);
assert.match(mark, /height="36"/);
assert.doesNotMatch(mark, /width="36" height="36"/);
assert.doesNotMatch(mark, /border-radius/);

const company = emailContainLogo({
  src: 'https://cdn.example.com/balance.png',
  alt: 'Balance',
  maxHeight: 64,
});
assert.match(company, /object-fit:contain/);
assert.match(company, /width:auto/);
assert.match(company, /height:auto/);
assert.doesNotMatch(company, /width="64" height="64"/);

const stretchedFooter = unstretchEmailLogos(
  '<img src="https://www.supplieradvisor.com/sa-logo.png" alt="SupplierAdvisor" width="40" height="40" style="display:block;margin:16px auto 10px;width:40px;height:40px;border:0;border-radius:12px;background:#ffffff;" />'
);
assert.match(stretchedFooter, /width="83"/);
assert.match(stretchedFooter, /height="36"/);
assert.doesNotMatch(stretchedFooter, /width="40" height="40"/);

const stretchedCompany = unstretchEmailLogos(
  '<img src="https://cdn.example.com/brand-logo.png" alt="Balance logo" width="64" height="64" style="width:64px;height:64px;" />'
);
assert.match(stretchedCompany, /object-fit:contain/);
assert.match(stretchedCompany, /width:auto/);
assert.doesNotMatch(stretchedCompany, /width="64" height="64"/);

const qr = '<img src="/qr.png" alt="Rate QR" width="64" height="64" />';
assert.equal(unstretchEmailLogos(qr), qr);

console.log('email-logos.test.ts ok');
