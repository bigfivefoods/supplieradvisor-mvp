/**
 * Run: NODE_PATH=../sa-mvp/node_modules npx tsx lib/fitness/special-dates-pdf.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildSpecialDatesPdf,
  parseSpecialDatesPdfBody,
  specialDatesPdfFilename,
} from './special-dates-pdf';

const bad = parseSpecialDatesPdfBody({ place: 'gym', from: '2026-10-13', rows: [] });
assert.equal(bad.ok, false);

const parsed = parseSpecialDatesPdfBody({
  place: 'practice',
  from: '2026-10-13',
  windowLabel: 'Next 30 days',
  windowId: '30',
  assigneeHeader: 'Clinician',
  missingBirthdays: 3,
  rows: [
    {
      name: 'Nia',
      kind: 'membership_anniversary',
      on: '2026-10-20',
      years: 2,
      days_until: 7,
      assignee: 'Dr Adey',
    },
    {
      name: 'Leo · Child of Nia',
      kind: 'birthday',
      on: '2026-10-18',
      years: 8,
      days_until: 5,
      assignee: 'Dr Adey',
    },
  ],
});
assert.equal(parsed.ok, true);
if (!parsed.ok) throw new Error('parse failed');
const input = parsed.value;

assert.equal(
  specialDatesPdfFilename('practice', '2026-10-13', '30'),
  'medicaladvisor-birthdays-2026-10-13-30.pdf'
);

function pdfPlain(src: string): string {
  return src.replace(/\[(.*?)\]\s*TJ/gs, (_, inner: string) => {
    let out = '';
    const re = /<([0-9A-Fa-f]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(inner))) {
      const hex = match[1];
      for (let i = 0; i + 1 < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
    }
    return out;
  });
}

async function main() {
  const pdf = await buildSpecialDatesPdf(input, { compress: false });
  const text = pdfPlain(pdf.toString('latin1'));
  assert.ok(pdf.subarray(0, 5).toString() === '%PDF-');
  assert.ok(text.includes('Leo · Child of Nia'), 'missing household name');
  assert.ok(text.includes('Patient anniversary'), 'missing practice wording');
  assert.ok(text.includes('MedicalAdvisor'));
  assert.ok(text.includes('Turns 8'));
  assert.ok(text.includes('Dr Adey'));
  assert.ok(text.includes('3 with no birthday on file'));

  const many = await buildSpecialDatesPdf(
    {
      place: 'gym',
      windowLabel: 'Next 12 months',
      from: '2026-10-13',
      assigneeHeader: 'Coach',
      missingBirthdays: 0,
      rows: Array.from({ length: 90 }, (_, i) => ({
        name: `Member ${i + 1}`,
        kind: 'birthday' as const,
        on: `2026-11-${String((i % 27) + 1).padStart(2, '0')}`,
        years: 30,
        days_until: i,
        assignee: 'Asha',
      })),
    },
    { compress: false }
  );
  const pageMarks = many.toString('latin1').match(/\/Type \/Page(?!s)/g) || [];
  assert.ok(pageMarks.length >= 2, `expected multiple pages, got ${pageMarks.length}`);
  console.log('special-dates-pdf.test.ts ok');
}

void main();
