'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Search,
  ShieldCheck,
  Star,
  FileText,
  Truck,
  Mail,
  TrendingUp,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  inviteStatusClass,
  srmStatusClass,
  trustBand,
  type SrmSupplierRecord,
} from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import { SupplierBookProfile } from '@/components/suppliers/SupplierBookProfile';

export default function SupplierNetworkPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <SuppliersPage>
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          </SuppliersPage>
        }
      >
        <NetworkInner />
      </Suspense>
    </CompanyRequired>
  );
}

function NetworkInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = Number(searchParams.get('id') || 0);
  const [rows, setRows] = useState<SrmSupplierRecord[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isFinite(urlId) && urlId > 0 ? urlId : null
  );
  const [selectedHold, setSelectedHold] = useState<SrmSupplierRecord | null>(
    null
  );

  useEffect(() => {
    if (Number.isFinite(urlId) && urlId > 0) setSelectedId(urlId);
  }, [urlId]);

  const setUrlId = (id: number | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (id && id > 0) next.set('id', String(id));
    else next.delete('id');
    const qs = next.toString();
    router.replace(`/dashboard/suppliers/network${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  };

  const selectSupplier = (s: SrmSupplierRecord | null) => {
    setSelectedId(s?.id ?? null);
    if (s) setSelectedHold(s);
    setUrlId(s?.id ?? null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (status !== 'all') params.set('status', status);
      if (q) params.set('q', q);
      const res = await fetch(`/api/suppliers?${params}`);
      const data = await res.json();
      const list = (data.suppliers || []) as SrmSupplierRecord[];
      setRows(list);
      if (data.warning) toast.message(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId, status, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    const hit = rows.find((s) => s.id === selectedId);
    if (hit) {
      setSelectedHold(hit);
      return;
    }
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({
        companyId: String(companyId),
        id: String(selectedId),
      });
      const res = await fetch(`/api/suppliers?${params}`);
      const data = await res.json();
      const found = ((data.suppliers || []) as SrmSupplierRecord[])[0];
      if (!cancelled && found) setSelectedHold(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedId, rows]);

  const selected =
    rows.find((s) => s.id === selectedId) ||
    (selectedHold && selectedHold.id === selectedId ? selectedHold : null);

  const invite = async (s: SrmSupplierRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (!s.email) {
      toast.error('No email on this supplier — edit and add contact email, or use Add / invite');
      return;
    }
    setBusyId(s.id);
    try {
      const res = await fetch('/api/suppliers/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          trading_name: s.trading_name,
          legal_name: s.legal_name || s.trading_name,
          contact_name: s.contact_name,
          contact_email: s.email,
          contact_phone: s.phone,
          industry: s.industry,
          city: s.city,
          country: s.country,
          invitedBy: 'Buyer',
          supplier_id: s.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(
        data.warning
          ? 'Invite created — share the link manually (email failed)'
          : 'Invitation sent'
      );
      const { toastGoldenPathFromResponse } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathFromResponse(data);
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(data.inviteLink);
          toast.message('Invite link copied');
        } catch {
          /* ignore */
        }
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: SrmSupplierRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (
      !confirm(
        `Delete ${s.trading_name} from your supplier book? This cannot be undone. If it has purchase orders, it will be archived instead.`
      )
    ) {
      return;
    }
    setBusyId(s.id);
    try {
      const params = new URLSearchParams({
        id: String(s.id),
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/suppliers?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success(
        data.archived
          ? `${s.trading_name} archived (still linked to orders)`
          : `${s.trading_name} deleted`
      );
      if (selectedId === s.id && !data.archived) selectSupplier(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SuppliersPage>
      <div className="pb-8">
        <SuppliersHeader
          title="My supplier network"
          description="Select a supplier to open the SRM profile that syncs with their portal — trading name, contacts, VAT, address, and documents."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/suppliers/discover"
                className="btn-secondary !py-2.5 !px-5 text-sm"
              >
                Discover
              </Link>
              <Link href="/dashboard/suppliers/add" className="btn-primary !py-2.5 !px-5 text-sm">
                Add supplier
              </Link>
            </div>
          }
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input w-full !py-2.5 !pl-10 !text-sm"
              placeholder="Search name, industry, cert, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input !py-2.5 !text-sm !w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="preferred">Preferred</option>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="blocked">Blocked</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] gap-4 items-start">
        <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden lg:order-1">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-sm text-neutral-500">
              No suppliers in your book yet.{' '}
              <Link href="/dashboard/suppliers/discover" className="text-[#00b4d8] underline">
                Discover
              </Link>{' '}
              or{' '}
              <Link href="/dashboard/suppliers/add" className="text-[#00b4d8] underline">
                invite
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.map((s) => {
                const trust = trustBand(Number(s.trust_score || 0));
                const canPo = Boolean(s.linked_profile_id);
                const canInvite =
                  !s.linked_profile_id &&
                  s.invite_status !== 'accepted' &&
                  Boolean(s.email);
                const isSelected = selectedId === s.id;
                return (
                  <li
                    key={s.id}
                    className={`px-5 py-4 flex flex-wrap gap-3 justify-between items-start ${
                      isSelected ? 'bg-sky-50/80' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-start gap-3">
                      <AccountLogoField
                        companyId={companyId}
                        privyUserId={privyUserId}
                        kind="supplier"
                        recordId={s.id}
                        logoUrl={
                          s.logo_url ||
                          (s as { linked_logo_url?: string | null }).linked_logo_url
                        }
                        name={s.trading_name}
                        size="sm"
                        compact
                        onChange={(url) =>
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === s.id ? { ...row, logo_url: url } : row
                            )
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() =>
                            selectSupplier(isSelected ? null : s)
                          }
                          className="font-semibold text-slate-800 text-left hover:text-[#0077b6]"
                        >
                          {s.trading_name}
                        </button>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${srmStatusClass(s.status)}`}
                        >
                          {s.status}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inviteStatusClass(s.invite_status)}`}
                        >
                          {(s.invite_status || 'not_invited').replace('_', ' ')}
                        </span>
                        {s.verified && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {s.connection_suspended && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-900">
                            Suspended
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {[s.industry, s.city, s.country].filter(Boolean).join(' · ') || '—'}
                        {s.email ? ` · ${s.email}` : ''}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(s.certifications || []).slice(0, 6).map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-800"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => selectSupplier(isSelected ? null : s)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                            isSelected
                              ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                              : 'border-[#00b4d8]/30 bg-[#00b4d8]/10 text-[#0077b6] hover:bg-[#00b4d8]/15'
                          }`}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          {isSelected ? 'Profile open' : 'Open profile'}
                        </button>
                        <Link
                          href={
                            canPo
                              ? `/dashboard/suppliers/po?supplierId=${s.id}`
                              : '/dashboard/suppliers/po'
                          }
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                            canPo
                              ? 'border-[#00b4d8]/30 bg-[#00b4d8]/10 text-[#0077b6] hover:bg-[#00b4d8]/15'
                              : 'border-neutral-200 text-neutral-400 cursor-not-allowed'
                          }`}
                          title={
                            canPo
                              ? 'Raise purchase order'
                              : 'Invite supplier to link a platform profile first'
                          }
                          onClick={(e) => {
                            if (!canPo) {
                              e.preventDefault();
                              toast.message('Link required', {
                                description:
                                  'Invite this supplier so they claim a profile before raising a PO.',
                              });
                            }
                          }}
                        >
                          <Truck className="w-3.5 h-3.5" /> Raise PO
                        </Link>
                        <Link
                          href="/dashboard/suppliers/documents"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
                        >
                          <FileText className="w-3.5 h-3.5" /> Documents
                        </Link>
                        <Link
                          href="/dashboard/suppliers/performance"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
                        >
                          <TrendingUp className="w-3.5 h-3.5" /> OTIFEF
                        </Link>
                        {canInvite && (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => void invite(s)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#00b4d8] bg-[#00b4d8] text-white hover:bg-[#0096c7] disabled:opacity-50 cursor-pointer"
                          >
                            {busyId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                            Invite
                          </button>
                        )}
                        {s.status !== 'archived' ? (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => void remove(s)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {busyId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Delete
                          </button>
                        ) : null}
                      </div>
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-1 shrink-0">
                      <div
                        className={`inline-flex px-2 py-0.5 rounded-full border font-semibold ${trust.className}`}
                      >
                        Trust {Number(s.trust_score || 0).toFixed(0)}
                      </div>
                      <div className="text-neutral-600">
                        OTIFEF <strong>{Number(s.otifef_pct || 0).toFixed(0)}%</strong>
                      </div>
                      {Number(s.rating_count || 0) > 0 && (
                        <div className="inline-flex items-center gap-1 text-amber-700 font-medium">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {Number(s.rating_avg || 0).toFixed(1)} ({s.rating_count})
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="order-first lg:order-2 lg:sticky lg:top-24">
        {selected ? (
          <SupplierBookProfile
            supplier={selected}
            companyId={companyId}
            privyUserId={privyUserId}
            onClose={() => selectSupplier(null)}
            onSaved={(next) => {
              setSelectedHold(next);
              setRows((prev) =>
                prev.map((row) => (row.id === next.id ? { ...row, ...next } : row))
              );
            }}
          />
        ) : (
          <div className="hidden lg:block rounded-[1.5rem] border border-dashed border-neutral-200 bg-white/70 px-5 py-10 text-center text-sm text-neutral-500">
            Select a supplier to see the full SRM profile — the same details
            that sync on their portal.
          </div>
        )}
        </div>
        </div>
      </div>
    </SuppliersPage>
  );
}
