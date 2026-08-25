/**
 * Run: npx --yes tsx lib/services/advisor-branded-email.test.ts
 */
import assert from 'node:assert/strict';
import {
  advisorEmailSkin,
  appointmentEndMs,
  clientEmailChrome,
  escapeEmailHtml,
  needsPostSessionEmail,
  renderAdvisorInvoiceEmail,
  renderAdvisorNoticeEmail,
  renderAdvisorSessionEmail,
  supplierAdvisorLogoUrl,
  wrapSystemNotificationHtml,
} from './advisor-branded-email';

assert.equal(advisorEmailSkin('medicalgraph').product, 'MedicalAdvisor®');
assert.equal(advisorEmailSkin('MedicalAdvisor®').accent, '#4f46e5');
assert.equal(advisorEmailSkin(null).product, 'SupplierAdvisor®');
assert.equal(advisorEmailSkin('fitgraph').accent, '#E8E830');
assert.equal(escapeEmailHtml('<x>'), '&lt;x&gt;');

const pre = renderAdvisorSessionEmail({
  kind: 'pre',
  personName: 'Ada',
  brand: 'CityCare',
  eventTitle: 'GP consult',
  date: '2026-08-20',
  start_time: '09:30',
  location: 'Surgery 1',
  logoUrl: '/uploads/logo.png',
  ctaUrl: '/member/medicalgraph/tok',
  moduleKey: 'medicalgraph',
});
assert.match(pre.subject, /Reminder/);
assert.match(pre.html, /MedicalAdvisor®/);
assert.match(pre.html, /CityCare/);
assert.match(pre.html, /See you soon, Ada/);
assert.match(pre.html, /GP consult/);
assert.match(pre.html, /View \/ manage booking/);
assert.match(pre.html, /Before you come/);
assert.match(pre.html, /SA Member/);
assert.match(pre.html, /ailments/);
assert.match(pre.html, /Update SA Member profile/);
assert.doesNotMatch(pre.html, /Rate your session/);

const post = renderAdvisorSessionEmail({
  kind: 'post',
  personName: 'Ada',
  brand: 'CityCare',
  eventTitle: 'GP consult',
  date: '2026-08-20',
  start_time: '09:30',
  ctaUrl: 'https://www.supplieradvisor.com/f/medicalgraph/1/ft_abc',
  moduleKey: 'medicalgraph',
});
assert.match(post.subject, /How was your visit/);
assert.match(post.html, /Rate your session/);
assert.match(post.html, /Rate the practice/);
assert.match(post.html, /session=5/);
assert.match(post.html, /practice=5/);
assert.doesNotMatch(post.html, /Before you come/);

assert.equal(
  appointmentEndMs({
    date: '2026-08-20',
    start_time: '09:00',
    end_time: '09:45',
  }),
  new Date('2026-08-20T09:45:00').getTime()
);
assert.equal(
  appointmentEndMs({
    date: '2026-08-20',
    start_time: '09:00',
    duration_min: 30,
  }),
  new Date('2026-08-20T09:00:00').getTime() + 30 * 60_000
);

const appt = { date: '2026-08-20', start_time: '09:00', end_time: '09:45' };
const after = new Date('2026-08-20T10:10:00').getTime();
const before = new Date('2026-08-20T09:50:00').getTime();
assert.equal(
  needsPostSessionEmail({ status: 'booked' }, appt, after),
  true
);
assert.equal(
  needsPostSessionEmail({ status: 'booked' }, appt, before),
  false
);
assert.equal(
  needsPostSessionEmail({ status: 'attended' }, appt, before),
  true
);
assert.equal(
  needsPostSessionEmail(
    { status: 'booked', post_session_emailed_at: 'x' },
    appt,
    after
  ),
  false
);
assert.equal(
  needsPostSessionEmail({ status: 'cancelled' }, appt, after),
  false
);

const invoice = renderAdvisorInvoiceEmail({
  personName: 'Ada',
  brand: 'Balance',
  description: 'Physio consult · 2026-08-19',
  amountLabel: 'R850',
  invoiceNumber: 'INV-1001',
  dueDate: '2026-08-19',
  ctaUrl: '/me?tab=account',
  moduleKey: 'physiograph',
});
assert.match(invoice.subject, /INV-1001/);
assert.match(invoice.subject, /Balance/);
assert.match(invoice.html, /PhysioAdvisor®/);
assert.match(invoice.html, /Invoice ready, Ada/);
assert.match(invoice.html, /View invoice in SA Member/);
assert.match(invoice.html, /R850/);
assert.match(invoice.html, /PhysioAdvisor®/);
assert.match(invoice.html, /sa-logo\.png/);

const withLogo = clientEmailChrome({
  moduleKey: 'fitgraph',
  logoUrl: 'https://cdn.example.com/vuka.png',
});
assert.equal(withLogo.companyLogo, 'https://cdn.example.com/vuka.png');
assert.equal(withLogo.hasModule, true);

const gymNoLogo = renderAdvisorSessionEmail({
  kind: 'pre',
  personName: 'Sam',
  brand: 'VUKA Fitness',
  eventTitle: 'VUKA Class',
  date: '2026-08-20',
  start_time: '06:00',
  ctaUrl: '/member/fitgraph/tok',
  moduleKey: 'fitgraph',
});
assert.match(gymNoLogo.html, /GymAdvisor®/);
assert.match(gymNoLogo.html, /VUKA Fitness/);
assert.match(gymNoLogo.html, /See you on the floor/);
assert.match(gymNoLogo.html, /Open VUKA Fitness app/);
assert.match(gymNoLogo.html, /Before class/);
assert.doesNotMatch(gymNoLogo.html, /medical aid/);
assert.doesNotMatch(gymNoLogo.html, /clinician/);
assert.doesNotMatch(gymNoLogo.html, /SA Member/);
assert.match(gymNoLogo.html, /sa-logo\.png/);
assert.doesNotMatch(gymNoLogo.html, /cdn\.example\.com/);
const gymChrome = clientEmailChrome({ moduleKey: 'fitgraph' });
assert.equal(gymChrome.ctaBg, '#111111');
assert.equal(gymChrome.ctaInk.toLowerCase(), '#e8e830');
const gymAvif = clientEmailChrome({
  moduleKey: 'fitgraph',
  logoUrl:
    'https://cdn.example.supabase.co/storage/v1/object/public/company-documents/110/logo.avif',
});
assert.match(String(gymAvif.companyLogo), /render\/image\/public/);

const coreOnly = renderAdvisorNoticeEmail({
  brand: 'Acme Trading',
  subject: 'Hello',
  headline: 'Welcome',
  leadHtml: 'Welcome to the network.',
  ctaUrl: '/me',
  ctaLabel: 'Open',
});
assert.match(coreOnly.html, /SupplierAdvisor®/);
assert.match(coreOnly.html, /sa-logo\.png/);
assert.doesNotMatch(coreOnly.html, /GymAdvisor/);
assert.ok(supplierAdvisorLogoUrl().includes('sa-logo.png'));
assert.match(supplierAdvisorLogoUrl(), /https:\/\/www\.supplieradvisor\.com\/sa-logo\.png/);
assert.match(coreOnly.html, /data-sa-email-chrome/);

const wrapped = wrapSystemNotificationHtml(
  '<p>Your PO was accepted.</p>',
  { companyName: 'VUKA Fitness' }
);
assert.match(wrapped, /data-sa-email-chrome/);
assert.match(wrapped, /SupplierAdvisor/);
assert.match(wrapped, /VUKA Fitness/);
assert.match(wrapped, /Your PO was accepted/);
const twice = wrapSystemNotificationHtml(wrapped);
assert.equal(twice, wrapped);

const wrappedLogo = wrapSystemNotificationHtml('<p>Hello</p>', {
  companyName: 'CityCare',
  companyLogoUrl: '/uploads/clinic.png',
  moduleKey: 'medicalgraph',
});
assert.match(wrappedLogo, /uploads\/clinic\.png/);
assert.match(wrappedLogo, /MedicalAdvisor/);
assert.match(wrappedLogo, /sa-logo\.png/);

console.log('advisor-branded-email.test.ts ok');
