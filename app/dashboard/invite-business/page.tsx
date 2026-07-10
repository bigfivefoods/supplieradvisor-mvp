'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Copy,
  Mail,
  Send,
  Loader2,
  Users,
  Truck,
  Handshake,
  Link2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import {
  CompanyRequired,
  ConnectionsHeader,
  ConnectionsPage,
} from '@/components/connections/ConnectionsShell';
import {
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

const RELATIONSHIP_TYPES = [
  {
    value: 'business',
    label: 'Partner / business',
    desc: 'General network partner — connect, then trade',
    icon: Handshake,
  },
  {
    value: 'supplier',
    label: 'Supplier',
    desc: 'They supply you — unlocks SRM POs & OTIFEF',
    icon: Truck,
  },
  {
    value: 'customer',
    label: 'Customer',
    desc: 'They buy from you — unlocks CRM quotes & orders',
    icon: Users,
  },
] as const;

type FormState = {
  trading_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  category: string;
  relationship_type: string;
  message: string;
};

const emptyForm = (): FormState => ({
  trading_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  category: '',
  relationship_type: 'business',
  message: '',
});

export default function InviteBusinessPage() {
  return (
    <CompanyRequired>
      <InviteInner />
    </CompanyRequired>
  );
}

function InviteInner() {
  const companyId = getSelectedCompanyId();
  const companyName = getSelectedCompanyName();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inviteLink: string;
    warning?: string;
    profileId?: number;
  } | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trading_name.trim() || !form.contact_email.trim()) {
      toast.error('Business name and contact email are required');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/invite-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trading_name: form.trading_name.trim(),
          contact_name: form.contact_name.trim() || undefined,
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim() || undefined,
          website: form.website.trim() || undefined,
          category: form.category.trim() || undefined,
          invitedBy: companyName || 'A SupplierAdvisor partner',
          inviterProfileId: companyId,
          relationship_type: form.relationship_type || 'business',
          message: form.message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send invitation');
        return;
      }

      setResult({
        inviteLink: data.inviteLink,
        warning: data.warning,
        profileId: data.profileId,
      });
      toast.success(
        data.warning ? 'Invite created (share the link manually)' : 'Invitation emailed'
      );
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(data.inviteLink);
          toast.message('Invite link copied to clipboard');
        } catch {
          /* ignore */
        }
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setForm(emptyForm());
  };

  return (
    <ConnectionsPage>
      <ConnectionsHeader
        title="Invite a"
        titleAccent="company"
        description="Onboard a partner, supplier, or customer onto SupplierAdvisor. They claim a secure link, complete verification, and join your integrated trade graph."
        action={
          <Link
            href="/dashboard/connections"
            className="btn-secondary !py-2.5 !px-5 text-sm"
          >
            <Link2 className="w-4 h-4" /> Network hub
          </Link>
        }
      />

      {!result ? (
        <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
          <form onSubmit={submit} className="lg:col-span-3 space-y-4">
            <Panel title="Company identity">
              <div className="p-5 space-y-3">
                <Field label="Business / trading name *">
                  <input
                    className="input w-full !p-3 !text-sm"
                    value={form.trading_name}
                    onChange={(e) => update('trading_name', e.target.value)}
                    required
                    placeholder="Acme Fresh Produce"
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Category / industry">
                    <input
                      className="input w-full !p-3 !text-sm"
                      value={form.category}
                      onChange={(e) => update('category', e.target.value)}
                      placeholder="Fresh produce, logistics…"
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      className="input w-full !p-3 !text-sm"
                      value={form.website}
                      onChange={(e) => update('website', e.target.value)}
                      placeholder="https://"
                    />
                  </Field>
                </div>
              </div>
            </Panel>

            <Panel title="Primary contact">
              <div className="p-5 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Contact name">
                    <input
                      className="input w-full !p-3 !text-sm"
                      value={form.contact_name}
                      onChange={(e) => update('contact_name', e.target.value)}
                      placeholder="Jane Dlamini"
                    />
                  </Field>
                  <Field label="Contact email *">
                    <input
                      type="email"
                      className="input w-full !p-3 !text-sm"
                      value={form.contact_email}
                      onChange={(e) => update('contact_email', e.target.value)}
                      required
                      placeholder="jane@acme.co.za"
                    />
                  </Field>
                </div>
                <Field label="Phone">
                  <input
                    className="input w-full !p-3 !text-sm"
                    value={form.contact_phone}
                    onChange={(e) => update('contact_phone', e.target.value)}
                    placeholder="+27…"
                  />
                </Field>
                <Field label="Personal note (optional)">
                  <textarea
                    className="input w-full !p-3 !text-sm min-h-[72px]"
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    placeholder="Why you’re inviting them onto the network…"
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Relationship intent">
              <div className="p-5 space-y-2">
                {RELATIONSHIP_TYPES.map((r) => {
                  const Icon = r.icon;
                  const active = form.relationship_type === r.value;
                  return (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        active
                          ? 'border-[#00b4d8] bg-[#00b4d8]/5 shadow-sm'
                          : 'border-neutral-200 bg-white hover:border-[#00b4d8]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="relationship_type"
                        className="mt-1"
                        checked={active}
                        onChange={() => update('relationship_type', r.value)}
                      />
                      <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#00b4d8]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{r.label}</div>
                        <div className="text-[11px] text-neutral-500 leading-relaxed">
                          {r.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </Panel>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-3.5 text-sm disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send invitation
                </>
              )}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <Panel title="What happens next">
              <div className="p-5 space-y-4">
                {[
                  {
                    n: '01',
                    title: 'Secure email',
                    body: 'They receive a branded invite with a one-time claim link.',
                  },
                  {
                    n: '02',
                    title: 'Privy sign-in',
                    body: 'Email code, Google, or Apple — then they own the company profile.',
                  },
                  {
                    n: '03',
                    title: 'Connect & trade',
                    body: 'Accept the network edge to unlock POs, invoices, marketplace, ratings, and RIAD.',
                  },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <span className="text-[10px] font-black tracking-[0.16em] text-[#00b4d8] mt-0.5">
                      {s.n}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                      <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                        {s.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="rounded-3xl border border-[#00b4d8]/20 bg-gradient-to-br from-white to-[#00b4d8]/[0.06] p-5">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-[#00b4d8]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Inviting as {companyName}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Your company name appears on the email. After they claim, continue in{' '}
                    <Link href="/dashboard/connections" className="text-[#00b4d8] font-semibold">
                      Network
                    </Link>{' '}
                    or specialised CRM / SRM invites for typed edges.
                  </p>
                </div>
              </div>
            </div>

            <Panel title="Also useful">
              <div className="p-3 space-y-1">
                <SideLink
                  href="/dashboard/suppliers/add"
                  icon={Truck}
                  label="Invite supplier (SRM)"
                  desc="Add to supplier book + claim flow"
                />
                <SideLink
                  href="/dashboard/customers/invites"
                  icon={Users}
                  label="Customer platform invites"
                  desc="Connect CRM accounts on-platform"
                />
                <SideLink
                  href="/dashboard/connections/marketplace"
                  icon={Building2}
                  label="Marketplace"
                  desc="Trade listed inventory after connect"
                />
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="max-w-xl">
          <Panel>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-800">
                    Invitation ready
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {form.trading_name || 'Company'} · {form.contact_email}
                  </p>
                </div>
              </div>

              {result.warning && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {result.warning}
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2.5 mb-4">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                Secure one-time claim link — share if email delivery fails.
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                Invite link
              </p>
              <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-2xl break-all text-xs font-mono text-slate-700 mb-5">
                {result.inviteLink}
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(result.inviteLink);
                  toast.success('Link copied');
                }}
                className="btn-primary w-full !py-3 text-sm mb-2"
              >
                <Copy className="w-4 h-4" /> Copy invite link
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn-secondary w-full !py-3 text-sm mb-2"
              >
                Invite another company
              </button>
              <Link
                href="/dashboard/connections"
                className="btn-secondary w-full !py-3 text-sm inline-flex items-center justify-center gap-2"
              >
                Open network hub <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
        </div>
      )}
    </ConnectionsPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SideLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[#00b4d8]/5 transition-colors group"
    >
      <div className="w-9 h-9 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#00b4d8]" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 group-hover:text-[#0077b6]">
          {label}
        </div>
        <div className="text-[11px] text-neutral-500">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto group-hover:text-[#00b4d8]" />
    </Link>
  );
}
