'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, Mail, Phone, X } from 'lucide-react';
import CompanyLogo from '@/components/business/CompanyLogo';
import {
  EMPTY_FIELD,
  mailHref,
  telHref,
  type DossierChip,
  type DossierSection,
  type ProfileDossier,
} from '@/lib/relationship/profile-dossier';

export type SheetAction = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: 'primary' | 'default' | 'danger';
  disabled?: boolean;
};

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8] focus-visible:ring-offset-2';

const CHIP: Record<DossierChip['tone'], string> = {
  good: 'bg-emerald-50 text-emerald-800',
  warn: 'bg-amber-50 text-amber-950',
  bad: 'bg-rose-50 text-rose-800',
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-sky-50 text-sky-900',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, summary, [tabindex]:not([tabindex="-1"])';

function show(value: string | null | undefined): string {
  const text = String(value || '').trim();
  return text || EMPTY_FIELD;
}

function FactGrid({ section }: { section: DossierSection }) {
  if (!section.facts.length) return null;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {section.facts.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {item.label}
          </dt>
          <dd className={`mt-0.5 text-sm font-semibold ${item.value ? 'text-slate-950' : 'text-slate-400'}`}>
            {item.value && item.href ? (
              <a href={item.href} className={`${focus} underline decoration-[#00b4d8] underline-offset-2`}>
                {item.value}
              </a>
            ) : (
              show(item.value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionBlock({ section }: { section: DossierSection }) {
  return (
    <section aria-labelledby={`profile-section-${section.id}`} className="rounded-3xl border border-slate-200 bg-white p-4">
      <h3
        id={`profile-section-${section.id}`}
        className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]"
      >
        {section.title}
      </h3>
      <SectionBody section={section} />
    </section>
  );
}

function SectionBody({ section }: { section: DossierSection }) {
  if (section.id === 'notes') {
    return (
      <div className="mt-3 space-y-3">
        <p className={`text-sm leading-relaxed ${section.note ? 'text-slate-800' : 'text-slate-500'}`}>
          {section.note || 'No notes on this record.'}
        </p>
        {section.tags.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {section.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No tags on this record.</p>
        )}
      </div>
    );
  }

  if (section.id === 'contacts') {
    if (!section.people.length) {
      return <p className="mt-3 text-sm text-slate-500">{section.empty}</p>;
    }
    return (
      <ul className="mt-3 space-y-2">
        {section.people.map((person) => {
          const email = mailHref(person.email);
          const phone = telHref(person.phone);
          return (
            <li key={person.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className={`text-sm font-black ${person.name ? 'text-slate-950' : 'text-slate-400'}`}>
                {show(person.name)}
              </p>
              <p className={`text-xs ${person.role ? 'text-slate-600' : 'text-slate-400'}`}>
                {person.role || 'Role not on file'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {email ? (
                  <a
                    href={email}
                    className={`${focus} inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 hover:border-[#00b4d8]`}
                  >
                    <Mail className="h-3.5 w-3.5 text-[#0077b6]" aria-hidden />
                    {person.email}
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center text-sm text-slate-400">
                    No email on file
                  </span>
                )}
                {phone ? (
                  <a
                    href={phone}
                    className={`${focus} inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 hover:border-[#00b4d8]`}
                  >
                    <Phone className="h-3.5 w-3.5 text-[#0077b6]" aria-hidden />
                    {person.phone}
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center text-sm text-slate-400">
                    No phone on file
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const bare =
    !section.facts.length &&
    !section.lines.length &&
    !section.docs.length &&
    !section.events.length;

  return (
    <>
      {bare ? <p className="mt-3 text-sm text-slate-500">{section.empty}</p> : null}
      <FactGrid section={section} />
      {section.lines.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {section.lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {line.kind.replace(/_/g, ' ')}
                </p>
                {line.href ? (
                  <Link
                    href={line.href}
                    className={`${focus} text-sm font-bold text-slate-950 underline decoration-[#00b4d8] underline-offset-2`}
                  >
                    {line.number}
                  </Link>
                ) : (
                  <p className="text-sm font-bold text-slate-950">{line.number}</p>
                )}
                <p className="text-xs text-slate-500">
                  {line.status}
                  {line.when ? ` · ${line.when}` : ''}
                </p>
              </div>
              <p className="text-sm font-black tabular-nums text-slate-950">{line.amountLabel}</p>
            </li>
          ))}
        </ul>
      ) : section.id === 'ledger' ? (
        <p className="mt-3 text-sm text-slate-500">{section.empty}</p>
      ) : null}
      {section.docs.length ? (
        <ul className="mt-3 space-y-1.5">
          {section.docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{doc.name}</span>
              {doc.state === 'on_file' && doc.href ? (
                <a
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${focus} inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#0077b6]`}
                >
                  On file <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-slate-400">
                  {doc.state === 'on_file' ? 'On file' : 'Missing'}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {section.events.length ? (
        <ol className="mt-3 space-y-3">
          {section.events.map((event) => (
            <li key={event.id} className="border-l-2 border-[#00b4d8] pl-3">
              <time className="text-xs font-semibold text-slate-500">{event.at}</time>
              <p className="text-sm font-bold text-slate-950">{event.title}</p>
              {event.detail ? (
                <p className="text-sm leading-snug text-slate-600">{event.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : section.id === 'activity' ? (
        <p className="mt-3 text-sm text-slate-500">{section.empty}</p>
      ) : null}
    </>
  );
}

function ActionButton({ action }: { action: SheetAction }) {
  const tone =
    action.tone === 'primary'
      ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950 hover:bg-[#00b4d8]'
      : action.tone === 'danger'
        ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
        : 'border-slate-200 bg-white text-slate-800 hover:border-[#00b4d8]';
  const className = `${focus} inline-flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-bold disabled:opacity-50 ${tone}`;
  if (action.href) {
    return (
      <Link href={action.href} className={className} onClick={action.onClick}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </button>
  );
}

/**
 * Slide-over for one customer or supplier. Escape closes. Tab stays inside.
 * Brand fill is #00b4d8 with slate-950 text.
 */
export function ProfileSheet({
  dossier,
  actions,
  onClose,
  children,
}: {
  dossier: ProfileDossier;
  actions: SheetAction[];
  onClose: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previously = document.activeElement as HTMLElement | null;
    panel.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && !el.closest('[hidden]')
      );

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      previously?.focus?.();
    };
  }, [mounted]);

  const sheet = (
    <div className="profile-sheet-root fixed inset-0 z-[80]">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-slate-950/40"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="party-profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="profile-sheet-panel absolute inset-0 flex flex-col bg-white outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(40rem,100%)] sm:shadow-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <CompanyLogo logoUrl={dossier.logoUrl} name={dossier.title} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
                {dossier.eyebrow}
              </p>
              <h2 id={titleId} className="truncate text-xl font-black tracking-tight text-slate-950">
                {dossier.title}
              </h2>
              <p className={`truncate text-sm ${dossier.legalName ? 'text-slate-600' : 'text-slate-400'}`}>
                {dossier.legalName || 'Legal name not on file'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`${focus} inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-100`}
              aria-label="Close profile"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dossier.chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHIP[chip.tone]}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {dossier.stats.map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-2xl bg-slate-50 px-2.5 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-black text-slate-950">{stat.value}</dd>
              </div>
            ))}
          </dl>
          {actions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <ActionButton key={action.id} action={action} />
              ))}
            </div>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6">
          {dossier.sections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
          {children}
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') return createPortal(sheet, document.body);
  return sheet;
}
