'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Boxes,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FilePenLine,
  Globe,
  HardHat,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Star,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { overdueInvoices, type Book, type TeamMember } from '@/lib/trades/desk';
import { officeOn, officeUsesCoreSidebar } from '@/lib/trades/office-nav';
import { complianceReminders, formatZar, quoteTotals, type ScheduleSlot } from '@/lib/trades/tradegraph';
import { TradeEmpty } from '@/components/trades/TradeUi';

type NavItem = { href: string; label: string; icon: LucideIcon };

export const OFFICE_NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: 'floor',
    label: 'Floor',
    items: [
      { href: '', label: 'Home', icon: LayoutDashboard },
      { href: '/board', label: 'Jobs', icon: HardHat },
      { href: '/quote', label: 'Quote', icon: FilePenLine },
      { href: '/gantt', label: 'Gantt', icon: CalendarRange },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/reports', label: 'Reports', icon: Wallet },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/team', label: 'Team', icon: HardHat },
      { href: '/sites', label: 'Sites', icon: MapPin },
      { href: '/messages', label: 'Messages', icon: MessageCircle },
      { href: '/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    id: 'yard',
    label: 'Yard',
    items: [
      { href: '/materials', label: 'Materials', icon: Boxes },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/arrival', label: 'Arrival', icon: Truck },
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/notices', label: 'Notices', icon: Megaphone },
      { href: '/website', label: 'Website', icon: Globe },
    ],
  },
];

const DOCK: NavItem[] = [
  { href: '', label: 'Home', icon: LayoutDashboard },
  { href: '/board', label: 'Jobs', icon: HardHat },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
];

const PILL: Record<string, string> = {
  enquiry: 'bg-slate-100 text-slate-700',
  quoted: 'bg-sky-100 text-sky-950',
  scheduled: 'bg-cyan-50 text-cyan-950',
  in_progress: 'bg-[#00b4d8] text-[#0f172a]',
  done: 'bg-emerald-100 text-emerald-900',
  invoiced: 'bg-amber-100 text-amber-950',
  paid: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-rose-100 text-rose-900',
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-sky-100 text-sky-950',
  accepted: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-rose-100 text-rose-900',
  issued: 'bg-amber-100 text-amber-950',
  part_paid: 'bg-amber-100 text-amber-950',
  void: 'bg-slate-100 text-slate-500',
  ordered: 'bg-sky-100 text-sky-950',
  received: 'bg-emerald-100 text-emerald-900',
  new: 'bg-violet-100 text-violet-950',
  overdue: 'bg-rose-100 text-rose-900',
  due: 'bg-amber-100 text-amber-950',
};

export function bookToday(token: string) {
  if (token === 'demo' || token === 'tg_harbour') return '2026-10-14';
  return new Date().toISOString().slice(0, 10);
}

export function prettyDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export { officeOn, officeUsesCoreSidebar } from '@/lib/trades/office-nav';

function sectionLabel(path: string, base: string) {
  for (const group of OFFICE_NAV_GROUPS) {
    for (const item of group.items) {
      if (officeOn(path, base, item.href)) return item.label;
    }
  }
  return 'Office';
}

export function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${PILL[key] || 'bg-slate-100 text-slate-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('') || '•';
}

function inkFor(colour: string) {
  return colour.toLowerCase() === '#00b4d8' ? '#0f172a' : '#ffffff';
}

export function AvatarStack({ people }: { people: { id?: string; name: string; colour?: string }[] }) {
  if (!people.length) return null;
  return (
    <div className="flex -space-x-1.5" aria-hidden>
      {people.slice(0, 3).map((person) => {
        const colour = person.colour || '#00b4d8';
        return (
          <span
            key={person.id || person.name}
            title={person.name}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-black"
            style={{ backgroundColor: colour, color: inkFor(colour) }}
          >
            {initials(person.name)}
          </span>
        );
      })}
    </div>
  );
}

export function jobFace(book: Book, jobId: string) {
  const job = book.store.jobs.find((row) => row.id === jobId);
  if (!job) return null;
  const customer = book.store.customers.find((row) => row.id === job.customer_id);
  const programme = book.desk.programmes.find((row) => row.job_id === job.id);
  const techs = (programme?.assignees || [])
    .map((id) => book.desk.team.find((member) => member.id === id))
    .filter((member): member is TeamMember => Boolean(member));
  const slot = book.store.schedule
    .filter((row) => row.job_id === job.id)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const invoices = book.store.invoices.filter((row) => row.job_id === job.id && row.status !== 'void');
  let cents = invoices.reduce((sum, row) => sum + row.total_cents, 0);
  if (!cents && job.quote_id) {
    const quote = book.store.quotes.find((row) => row.id === job.quote_id);
    if (quote) cents = quoteTotals(quote.lines, book.store.settings.vat_rate).total_cents;
  }
  if (!cents && job.lines.length) cents = quoteTotals(job.lines, book.store.settings.vat_rate).total_cents;
  return { job, customer, techs, slot, cents };
}

export function JobFaceMeta({ book, jobId }: { book: Book; jobId: string }) {
  const face = jobFace(book, jobId);
  if (!face) return null;
  return (
    <div className="mt-2 space-y-2">
      <p className="truncate text-xs text-slate-600">
        {face.customer ? <span className="font-bold text-slate-800">{face.customer.name}</span> : null}
        {face.customer && face.job.address ? ' · ' : null}
        {face.job.address}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {face.slot ? (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-950">
              {face.slot.starts_at.slice(11, 16)}
            </span>
          ) : null}
          <AvatarStack people={face.techs} />
        </div>
        {face.cents ? <span className="shrink-0 text-sm font-black tabular-nums text-slate-900">{formatZar(face.cents)}</span> : null}
      </div>
    </div>
  );
}

export function PageHead({
  kicker,
  title,
  detail,
  children,
}: {
  kicker: string;
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="h-1.5 bg-[#00b4d8]" />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8]">{kicker}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          {detail ? <p className="mt-1 max-w-3xl text-sm leading-snug text-slate-600">{detail}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}

export function MoneyBars({ rows }: { rows: { label: string; cents: number }[] }) {
  const max = Math.max(...rows.map((row) => row.cents), 1);
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No billed jobs yet. Invoice from the Gantt to fill this chart.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs font-bold text-slate-700">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{formatZar(row.cents)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#00b4d8]" style={{ width: `${Math.max(6, Math.round((row.cents / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DayTimeline({ book, slots }: { book: Book; slots: ScheduleSlot[] }) {
  const rows = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!rows.length) {
    return <TradeEmpty title="Nothing on today" hint="Scheduled visits land on this timeline." icon={<CalendarDays />} />;
  }
  return (
    <ol className="relative space-y-3 border-l-2 border-[#00b4d8]/50 pl-4">
      {rows.map((slot) => {
        const job = slot.job_id ? book.store.jobs.find((row) => row.id === slot.job_id) : null;
        const face = job ? jobFace(book, job.id) : null;
        return (
          <li key={slot.id} className="relative">
            <span className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full bg-[#00b4d8] ring-4 ring-white" aria-hidden />
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#0f766e]">
                  {slot.starts_at.slice(11, 16)}–{slot.ends_at.slice(11, 16)}
                </p>
                {job ? <StatusPill status={job.status} /> : null}
              </div>
              <p className="mt-1 font-black text-slate-900">{slot.title}</p>
              <p className="text-sm text-slate-600">
                {face?.customer ? `${face.customer.name} · ` : ''}
                {slot.address}
              </p>
              {face ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AvatarStack people={face.techs} />
                  {face.cents ? <span className="text-sm font-black tabular-nums">{formatZar(face.cents)}</span> : null}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export function moneyRows(book: Book) {
  return book.store.jobs
    .map((job) => {
      const cents = book.store.invoices
        .filter((row) => row.job_id === job.id && row.status !== 'void')
        .reduce((sum, row) => sum + row.total_cents, 0);
      return { label: `${job.number} · ${job.title}`, cents };
    })
    .filter((row) => row.cents > 0)
    .slice(0, 5);
}

export function officeAlerts(book: Book, today: string, base: string) {
  const alerts: { id: string; title: string; detail: string; href: string; tone: 'rose' | 'amber' | 'sky' }[] = [];
  for (const row of overdueInvoices(book, today).slice(0, 3)) {
    alerts.push({
      id: row.invoice.id,
      title: `${row.invoice.number} is overdue`,
      detail: `${formatZar(row.balance_cents)} · ${row.days} day${row.days === 1 ? '' : 's'}`,
      href: `${base}/invoices`,
      tone: 'rose',
    });
  }
  for (const quote of book.store.quotes.filter((row) => row.status === 'sent').slice(0, 2)) {
    const customer = book.store.customers.find((row) => row.id === quote.customer_id);
    alerts.push({
      id: quote.id,
      title: `${quote.number} waiting on a signature`,
      detail: customer?.name || quote.title,
      href: `${base}/quote`,
      tone: 'sky',
    });
  }
  for (const cert of complianceReminders(book.store.compliance, today).slice(0, 2)) {
    alerts.push({
      id: cert.id,
      title: `${cert.kind.toUpperCase()} ${cert.level === 'overdue' ? 'expired' : 'due soon'}`,
      detail: `${cert.holder} · ${cert.expires_on}`,
      href: `${base}/compliance`,
      tone: cert.level === 'overdue' ? 'rose' : 'amber',
    });
  }
  for (const task of book.desk.tasks.filter((row) => !row.done).slice(0, 2)) {
    alerts.push({
      id: task.id,
      title: task.title,
      detail: `Due ${task.due}`,
      href: `${base}/tasks`,
      tone: 'amber',
    });
  }
  return alerts.slice(0, 6);
}

const TONE = {
  rose: 'border-rose-100 bg-rose-50',
  amber: 'border-amber-100 bg-amber-50',
  sky: 'border-sky-100 bg-sky-50',
};

export function AlertList({ items }: { items: ReturnType<typeof officeAlerts> }) {
  if (!items.length) {
    return <TradeEmpty title="Nothing needs you" hint="Overdue invoices, unsigned quotes, and expiring certificates show up here." icon={<Bell />} />;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className={`block rounded-2xl border px-3 py-2.5 ${TONE[item.tone]}`}>
            <p className="text-sm font-black text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-600">{item.detail}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NavLink({ base, item, path, onPick }: { base: string; item: NavItem; path: string; onPick?: () => void }) {
  const on = officeOn(path, base, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={`${base}${item.href}` || base}
      aria-current={on ? 'page' : undefined}
      onClick={onPick}
      className={`flex min-h-10 items-center gap-2.5 rounded-2xl px-3 text-sm font-bold transition ${
        on ? 'bg-[#00b4d8] text-[#0f172a] shadow-sm' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

export function TradeOfficeFrame({
  base,
  brand,
  city,
  phone,
  bare = false,
  children,
}: {
  base: string;
  brand: string;
  city: string;
  phone: string;
  bare?: boolean;
  children: ReactNode;
}) {
  const path = usePathname() || base;
  const [more, setMore] = useState(false);
  const section = sectionLabel(path, base);
  if (bare) {
    return <main className="min-h-dvh bg-gradient-to-b from-sky-50 to-slate-100 text-slate-900">{children}</main>;
  }
  // Signed-in office sits in the core dashboard sidebar. No second column, no phone dock.
  if (officeUsesCoreSidebar(base)) {
    return (
      <div className="min-w-0 text-slate-900" data-office-chrome="core">
        {children}
      </div>
    );
  }
  return (
    <main className="min-h-dvh bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100 text-slate-900" data-office-chrome="preview">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="bg-[#00b4d8] px-4 py-5 text-[#0f172a]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]/70">TradeAdvisor®</p>
            <p className="mt-1 truncate text-lg font-black leading-tight">{brand}</p>
            <p className="truncate text-xs font-semibold text-[#0f172a]/80">{city}{phone ? ` · ${phone}` : ''}</p>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="TradeAdvisor®">
            {OFFICE_NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href || 'home'} base={base} item={item} path={path} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[#00b4d8] px-4 py-3 text-[#0f172a] lg:hidden">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f172a]/70">TradeAdvisor®</p>
              <p className="truncate text-sm font-black">{brand}</p>
            </div>
            <span className="shrink-0 rounded-2xl bg-white/40 px-2.5 py-1 text-xs font-black">{section}</span>
          </div>
          <div className="w-full px-4 py-4 pb-28 sm:px-6 lg:px-8 lg:py-6 lg:pb-8">{children}</div>
        </div>
      </div>
      {more ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-16 max-h-[72dvh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">All sections</p>
            <div className="mt-3 space-y-4">
              {OFFICE_NAV_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{group.label}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {group.items.map((item) => (
                      <NavLink key={item.label} base={base} item={item} path={path} onPick={() => setMore(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur lg:hidden" aria-label="TradeAdvisor®">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {DOCK.map((item) => {
            const on = officeOn(path, base, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={`${base}${item.href}` || base}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black ${
                  on ? 'bg-[#00b4d8] text-[#0f172a]' : 'text-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black ${more ? 'bg-[#00b4d8] text-[#0f172a]' : 'text-slate-600'}`}
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
          >
            <Menu className="h-4 w-4" aria-hidden />
            More
          </button>
        </div>
      </nav>
    </main>
  );
}
