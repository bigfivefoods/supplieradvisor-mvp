'use client';

/**
 * SP → wholesaler invites for NSNP supply chain.
 * Uses the platform supplier invite API so wholesalers can claim a company,
 * receive POs, and send quotes. They may decline — invite still creates a book entry.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Loader2,
  Mail,
  Package,
  RefreshCw,
  Send,
  ShoppingCart,
  Truck,
  UserPlus,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  inviteStatusClass,
  type SupplierInvitation,
} from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';

export default function SpWholesalersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const programme = useProgrammeRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [invites, setInvites] = useState<SupplierInvitation[]>([]);
  const [form, setForm] = useState({
    trading_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    message: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/suppliers/invites?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        throw new Error(data.error || 'Failed to load invites');
      }
      setInvites(data.invitations || []);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendInvite = async () => {
    if (!form.trading_name.trim()) {
      return toast.error('Wholesaler / supplier trading name required');
    }
    if (!form.contact_email.trim()) {
      return toast.error('Email required so we can send the invite');
    }
    setSaving(true);
    try {
      const defaultMsg =
        form.message.trim() ||
        'We supply schools under the NSNP programme and would like you on SupplierAdvisor so we can send purchase orders and receive quotes for food commodities.';
      const res = await fetch('/api/suppliers/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          privyUserId,
          trading_name: form.trading_name.trim(),
          legal_name: form.trading_name.trim(),
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim() || null,
          city: form.city.trim() || null,
          country: 'South Africa',
          industry: 'Food wholesale',
          category: 'NSNP wholesaler',
          message: defaultMsg,
          invitedBy: 'NSNP service provider',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(
        data.warning
          ? 'Invite saved — email failed; copy the link and share it manually'
          : 'Invite sent — wholesaler can join and take over their profile'
      );
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(String(data.inviteLink));
          toast.message('Invite link copied — share via WhatsApp if useful');
        } catch {
          /* ignore */
        }
      }
      setForm({
        trading_name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        city: '',
        message: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: number, action: 'resend' | 'revoke') => {
    setBusy(id);
    try {
      const res = await fetch('/api/suppliers/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          privyUserId,
          invitationId: id,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'resend' ? 'Invite resent' : 'Invite revoked');
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(String(data.inviteLink));
          toast.message('Link copied');
        } catch {
          /* ignore */
        }
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const pending = invites.filter((i) => i.status === 'pending').length;
  const accepted = invites.filter(
    (i) => i.status === 'accepted' || i.status === 'claimed'
  ).length;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Invite wholesalers"
        titleAccent="SP · supply chain"
        mode="isp"
        description="Invite food wholesalers and manufacturers onto SupplierAdvisor so you can raise POs, request quotes, and receive confirmations. They may not join — the invite is still worth sending and creates a supplier book entry for offline follow-up."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {programme.role !== 'sp' && !programme.loading ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This page is for <strong>service providers</strong> sourcing from
          wholesalers. Schools order from SPs; SPs buy from the trade network.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {[
          {
            href: '/dashboard/suppliers/po',
            icon: ShoppingCart,
            title: 'Raise POs',
            desc: 'Order stock from wholesalers once connected',
          },
          {
            href: '/dashboard/suppliers/network',
            icon: Building2,
            title: 'Supplier book',
            desc: 'All wholesalers you added or invited',
          },
          {
            href: '/dashboard/suppliers/discover',
            icon: Package,
            title: 'Discover',
            desc: 'Find suppliers already on the platform',
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
          >
            <c.icon className="w-5 h-5 text-amber-600 mb-2" />
            <p className="font-bold text-sm">{c.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/80 via-white to-sky-50 p-5 space-y-3">
          <p className="text-sm font-black inline-flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-700" />
            Invite a wholesaler
          </p>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            We email them a secure link to join SupplierAdvisor, claim their
            company, and trade with you. If they never join, you still have
            their details in your supplier book for phone / WhatsApp orders.
          </p>

          <label className="block text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Trading name *
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white"
              value={form.trading_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, trading_name: e.target.value }))
              }
              placeholder="e.g. KZN Food Wholesalers"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Contact email *
            </span>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
              placeholder="orders@wholesaler.co.za"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Contact name
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.contact_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_name: e.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Phone
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.contact_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
                placeholder="Optional"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              City / town
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.city}
              onChange={(e) =>
                setForm((f) => ({ ...f, city: e.target.value }))
              }
              placeholder="e.g. Durban"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Personal note (optional)
            </span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-h-[72px]"
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              placeholder="We supply NSNP schools and need maize, beans, oil on weekly POs…"
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void sendInvite()}
            className="btn-primary !py-3 !px-4 text-sm w-full inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send invite email
          </button>
          <p className="text-[10px] text-slate-500 leading-snug">
            After they join: connect → request quotes → raise POs → receive
            stock for school deliveries. Full trade tools live under{' '}
            <Link
              href="/dashboard/suppliers"
              className="font-bold text-[#0077b6] underline"
            >
              Suppliers
            </Link>
            .
          </p>
        </div>

        <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black inline-flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0077b6]" />
              Invitations
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {pending} pending · {accepted} joined · {invites.length} total
            </p>
          </div>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : invites.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Truck className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-bold text-slate-800">No wholesaler invites yet</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Invite at least one preferred wholesaler for maize, beans, oil
                and other NSNP lines you buy in bulk.
              </p>
            </div>
          ) : (
            <ul className="divide-y max-h-[28rem] overflow-y-auto">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">
                      {inv.company_name || inv.email}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {inv.email}
                      {inv.full_name ? ` · ${inv.full_name}` : ''}
                      {inv.expires_at
                        ? ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inviteStatusClass(inv.status)}`}
                    >
                      {inv.status}
                    </span>
                    {inv.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === inv.id}
                          onClick={() => void act(inv.id, 'resend')}
                          className="text-[10px] font-bold text-[#0077b6] px-2 py-1 rounded-lg border border-sky-100 hover:bg-sky-50"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          disabled={busy === inv.id}
                          onClick={() => void act(inv.id, 'revoke')}
                          className="text-[10px] font-bold text-rose-700 px-2 py-1 rounded-lg border border-rose-100 hover:bg-rose-50"
                        >
                          Revoke
                        </button>
                      </>
                    ) : null}
                    {inv.status === 'accepted' || inv.status === 'claimed' ? (
                      <Link
                        href="/dashboard/suppliers/po"
                        className="text-[10px] font-bold text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50"
                      >
                        Raise PO
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600 leading-relaxed">
        <strong className="text-slate-900">Tip:</strong> Wholesalers do not need
        to be on the DBE programme. They are your trade suppliers. Schools only
        order from you (the SP) on approved catalogue products; you source those
        products from wholesalers here.
        <span className="block mt-1 text-slate-500">
          Also available under Suppliers → Invite for the full SRM book.
        </span>
      </div>
    </SchoolsPage>
  );
}
