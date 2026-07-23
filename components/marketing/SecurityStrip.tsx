'use client';

import {
  Shield,
  Lock,
  Users,
  FileSearch,
  Server,
  KeyRound,
} from 'lucide-react';

const ITEMS = [
  {
    icon: Users,
    title: 'Role-based access',
    body: 'Owner, admin, finance, ops, viewer, sales contractor — module rights per person.',
  },
  {
    icon: Lock,
    title: 'Company-scoped data',
    body: 'Membership gates every API. Multi-entity groups keep workspaces clean.',
  },
  {
    icon: FileSearch,
    title: 'Audit-ready trails',
    body: 'Journals, PO status, QA holds, CAPA, and activity logs for scrutiny.',
  },
  {
    icon: Server,
    title: 'Cloud Postgres + RLS',
    body: 'Supabase-backed with row-level security patterns and service isolation.',
  },
  {
    icon: KeyRound,
    title: 'Modern auth',
    body: 'Privy-based sign-in with team invites — no shared hero passwords.',
  },
  {
    icon: Shield,
    title: 'Controls where trade happens',
    body: 'SHEQ, holds, and verification live in the same OS as POs and stock.',
  },
];

export default function SecurityStrip() {
  return (
    <section
      id="security"
      className="scroll-mt-20 border-t border-slate-200 bg-[#0f172a] py-16 sm:py-20 text-white"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
            Trust & security
          </p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Built for operators who get audited
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            B2G buyers and serious B2B partners expect roles, trails, and holds —
            not screenshots of a spreadsheet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
            >
              <item.icon className="mb-3 h-5 w-5 text-cyan-300" />
              <h3 className="font-bold text-white">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
