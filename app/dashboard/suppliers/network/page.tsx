'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Mail,
  Trash2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  inviteStatusClass,
  srmStatusClass,
  type SrmSupplierRecord,
  type SupplierOtifefRow,
} from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { SupplierBookProfile } from '@/components/suppliers/SupplierBookProfile';
import type { PartyRoleRow } from '@/lib/accounting/party-roles';
import { glCodeFromMeta } from '@/lib/accounting/party-roles';
import {
  SrmBoard,
  SrmEmpty,
  SrmSearch,
  SrmSelect,
  SrmSkeleton,
  SrmSortButton,
  SrmToolbar,
  SrmViewSwitch,
  srmFocus,
} from '@/components/suppliers/srm/SrmDesk';
import {
  compareNum,
  compareText,
  supplierBoardColumn,
  supplierTimeline,
  SUPPLIER_BOARD_COLUMNS,
  type SrmView,
} from '@/lib/suppliers/srm-desk';
import { ProfileCard } from '@/components/relationship/ProfileCard';
import { ProfileSheet, type SheetAction } from '@/components/relationship/ProfileSheet';
import {
  supplierDossier,
  supplierLedgerLines,
  type DossierDoc,
  type DossierLine,
} from '@/lib/relationship/profile-dossier';
import { isSrmPreviewId, srmPreviewBook } from '@/lib/suppliers/srm-preview';

export default function SupplierNetworkPage({
  preview,
}: {
  preview?: { companyId: number; id: number | null };
} = {}) {
  if (preview) {
    return (
      <CompanyRequired assumedCompanyId={preview.companyId}>
        <NetworkInner urlId={preview.id ?? 0} assumedCompanyId={preview.companyId} />
      </CompanyRequired>
    );
  }
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
        <NetworkFromSearch />
      </Suspense>
    </CompanyRequired>
  );
}

function NetworkFromSearch() {
  const searchParams = useSearchParams();
  const urlId = Number(searchParams.get('id') || 0);
  return <NetworkInner urlId={Number.isFinite(urlId) ? urlId : 0} />;
}

function NetworkInner({
  urlId,
  assumedCompanyId,
}: {
  urlId: number;
  assumedCompanyId?: number;
}) {
  const companyId = assumedCompanyId ?? getSelectedCompanyId()!;
  const previewMode = assumedCompanyId != null;
  const previewBook = previewMode ? srmPreviewBook() : null;
  const seedId = Number.isFinite(urlId) && urlId !== 0 ? urlId : null;
  const seedSupplier =
    previewBook && seedId ? previewBook.suppliers.find((row) => row.id === seedId) || null : null;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const [rows, setRows] = useState<SrmSupplierRecord[]>(previewBook?.suppliers || []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(!previewMode);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(seedId);
  const [lines, setLines] = useState<DossierLine[]>(
    previewBook && seedId ? supplierLedgerLines(previewBook.purchaseOrders, seedId) : []
  );
  const [vault, setVault] = useState<DossierDoc[]>(
    previewBook && seedId
      ? previewBook.documents
          .filter((doc) => Number(doc.supplier_id) === seedId)
          .map((doc) => ({
            id: String(doc.id),
            name: String(doc.title || 'Document'),
            state: 'on_file' as const,
            href: doc.file_url ? String(doc.file_url) : null,
          }))
      : []
  );
  const [scorecard, setScorecard] = useState<Partial<SupplierOtifefRow> | null>(
    previewBook && seedId
      ? previewBook.scorecards.find((row) => row.srm_supplier_id === seedId) || null
      : null
  );
  const [ledgerState, setLedgerState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [selectedHold, setSelectedHold] = useState<SrmSupplierRecord | null>(seedSupplier);
  const [partyBySupplier, setPartyBySupplier] = useState<
    Record<number, PartyRoleRow>
  >({});
  const [view, setView] = useState<SrmView>('list');
  const [sort, setSort] = useState<'name' | 'trust' | 'otifef'>('name');

  useEffect(() => {
    if (Number.isFinite(urlId) && urlId !== 0) setSelectedId(urlId);
  }, [urlId]);

  const setUrlId = (id: number | null) => {
    const onWalkthrough =
      previewMode ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/srm'));
    const next = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (id) next.set('id', String(id));
    else next.delete('id');
    const qs = next.toString();
    const path = onWalkthrough ? '/preview/srm' : '/dashboard/suppliers/network';
    router.replace(`${path}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const selectSupplier = (s: SrmSupplierRecord | null) => {
    setSelectedId(s?.id ?? null);
    if (s) setSelectedHold(s);
    setUrlId(s?.id ?? null);
  };

  const load = useCallback(async () => {
    if (
      previewMode ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/srm'))
    ) {
      setRows(srmPreviewBook().suppliers);
      setPartyBySupplier({});
      setLoading(false);
      return;
    }
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
      try {
        const partyRes = await fetch(
          `/api/accounting/parties?companyId=${companyId}`
        );
        const partyData = await partyRes.json();
        const idx: Record<number, PartyRoleRow> = {};
        for (const row of (partyData.parties || []) as PartyRoleRow[]) {
          if (row.supplier_id) idx[row.supplier_id] = row;
        }
        setPartyBySupplier(idx);
      } catch {
        setPartyBySupplier({});
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, previewMode, status, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    if (isSrmPreviewId(selectedId)) {
      const found = srmPreviewBook().suppliers.find((row) => row.id === selectedId) || null;
      if (found) setSelectedHold(found);
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
  }, [companyId, selectedId]);

  const visible = useMemo(() => {
    let copy = [...rows];
    if (copy.some((row) => isSrmPreviewId(row.id))) {
      const query = q.trim().toLowerCase();
      if (query) {
        copy = copy.filter((s) =>
          [s.trading_name, s.legal_name, s.email, s.city, s.industry, ...(s.certifications || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        );
      }
      if (status !== 'all') copy = copy.filter((s) => (s.status || 'prospect') === status);
    }
    copy.sort((a, b) => {
      if (sort === 'trust') {
        return compareNum(Number(a.trust_score || 0), Number(b.trust_score || 0), 'desc');
      }
      if (sort === 'otifef') {
        return compareNum(Number(a.otifef_pct || 0), Number(b.otifef_pct || 0), 'desc');
      }
      return compareText(a.trading_name || '', b.trading_name || '', 'asc');
    });
    return copy;
  }, [rows, sort, q, status]);

  const listRow = rows.find((s) => s.id === selectedId);
  const selected =
    selectedHold && selectedHold.id === selectedId
      ? { ...(listRow || {}), ...selectedHold }
      : listRow || null;

  useEffect(() => {
    if (!selectedId) {
      setLines([]);
      setVault([]);
      setScorecard(null);
      setLedgerState('ready');
      return;
    }
    if (isSrmPreviewId(selectedId)) {
      const book = srmPreviewBook();
      setLines(supplierLedgerLines(book.purchaseOrders, selectedId));
      setVault(
        book.documents
          .filter((doc) => Number(doc.supplier_id) === selectedId)
          .map((doc) => ({
            id: String(doc.id),
            name: String(doc.title || 'Document'),
            state: 'on_file' as const,
            href: doc.file_url ? String(doc.file_url) : null,
          }))
      );
      setScorecard(book.scorecards.find((row) => row.srm_supplier_id === selectedId) || null);
      setLedgerState('ready');
      return;
    }
    let cancelled = false;
    setLedgerState('loading');
    void (async () => {
      try {
        const [poRes, docRes, scoreRes] = await Promise.all([
          fetch(
            `/api/suppliers/purchase-orders?companyId=${companyId}${
              privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''
            }`
          ),
          fetch(`/api/suppliers/documents?companyId=${companyId}&supplierId=${selectedId}`),
          fetch(`/api/suppliers/otifef?companyId=${companyId}`),
        ]);
        const [poData, docData, scoreData] = await Promise.all([
          poRes.json(),
          docRes.json(),
          scoreRes.json(),
        ]);
        if (cancelled) return;
        setLines(supplierLedgerLines(poData.purchaseOrders || [], selectedId));
        setVault(
          ((docData.documents || []) as Array<Record<string, unknown>>).map((doc, index) => ({
            id: String(doc.id || `vault-${index}`),
            name: String(doc.title || doc.doc_type || 'Document'),
            state: 'on_file' as const,
            href: doc.file_url ? String(doc.file_url) : null,
          }))
        );
        const row = ((scoreData.rows || []) as SupplierOtifefRow[]).find(
          (item) =>
            Number(item.srm_supplier_id) === selectedId || Number(item.supplier_id) === selectedId
        );
        setScorecard(row || null);
        setLedgerState(poRes.ok || docRes.ok ? 'ready' : 'error');
      } catch {
        if (!cancelled) {
          setLines([]);
          setVault([]);
          setScorecard(null);
          setLedgerState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId, selectedId]);

  const invite = async (s: SrmSupplierRecord) => {
    if (isSrmPreviewId(s.id)) {
      toast.message('Sample book — nothing is saved on SupplierAdvisor®');
      return;
    }
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
    if (isSrmPreviewId(s.id)) {
      toast.message('Sample book — nothing is saved on SupplierAdvisor®');
      return;
    }
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

  const supplierParty = selected ? partyBySupplier[selected.id] : undefined;
  const dossier = selected
    ? supplierDossier(selected, {
        lines,
        vault,
        scorecard,
        ledgerState,
        activity: supplierTimeline(selected).map((event) => ({
          id: event.id,
          at: event.at.slice(0, 10),
          title: event.title,
          detail: event.detail,
        })),
        books: supplierParty
          ? {
              role: supplierParty.role,
              ar: supplierParty.ar_account_code,
              ap: supplierParty.ap_account_code || glCodeFromMeta(selected.metadata),
            }
          : undefined,
      })
    : null;
  const profileActions: SheetAction[] = selected
    ? [
        {
          id: 'scorecard',
          label: 'Open scorecard',
          href: '/dashboard/suppliers/performance',
          tone: 'primary',
        },
        {
          id: 'po',
          label: 'Raise PO',
          href: `/dashboard/suppliers/po?supplierId=${selected.id}`,
        },
        {
          id: 'docs',
          label: 'Documents',
          href: '/dashboard/suppliers/documents',
        },
        {
          id: 'portal',
          label: 'Portal',
          href: '/dashboard/suppliers/portal',
        },
        ...(!selected.linked_profile_id &&
        selected.invite_status !== 'accepted' &&
        selected.email
          ? [
              {
                id: 'invite',
                label: 'Invite',
                onClick: () => void invite(selected),
                disabled: busyId === selected.id,
              } satisfies SheetAction,
            ]
          : []),
        ...(selected.status !== 'archived'
          ? [
              {
                id: 'delete',
                label: 'Delete',
                tone: 'danger' as const,
                onClick: () => void remove(selected),
                disabled: busyId === selected.id,
              } satisfies SheetAction,
            ]
          : []),
      ]
    : [];

  return (
    <SuppliersPage>
      <div className="pb-8">
        <SuppliersHeader
          title="My supplier network"
          description="The supply book. Open a profile card for every field, the scorecard, and the purchase orders."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/suppliers/discover"
                className="btn-secondary !py-2.5 !px-5 text-sm"
              >
                Discover
              </Link>
              <Link
                href="/dashboard/suppliers/add"
                className="inline-flex min-h-11 items-center rounded-full bg-[#00b4d8] px-5 text-sm font-bold text-slate-950"
              >
                Add supplier
              </Link>
            </div>
          }
        />

        <SrmToolbar
          meta={
            loading
              ? 'Loading the supply book…'
              : `${visible.length} supplier${visible.length === 1 ? '' : 's'}`
          }
        >
          <SrmSearch
            value={q}
            onChange={setQ}
            label="Search suppliers"
            placeholder="Search name, industry, cert, city…"
          />
          <SrmSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'preferred', label: 'Preferred' },
              { value: 'active', label: 'Active' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <SrmSortButton label="Name" active={sort === 'name'} onClick={() => setSort('name')} />
            <SrmSortButton label="Trust" active={sort === 'trust'} onClick={() => setSort('trust')} />
            <SrmSortButton label="OTIFEF" active={sort === 'otifef'} onClick={() => setSort('otifef')} />
          </div>
          <SrmViewSwitch value={view} onChange={setView} />
        </SrmToolbar>

        <div>
        <div className="min-w-0">
          {loading ? (
            <SrmSkeleton rows={5} variant={view === 'table' ? 'table' : 'list'} />
          ) : visible.length === 0 ? (
            <SrmEmpty
              title="No suppliers in this view"
              description="Discover a partner on the network, or add someone who is not on SupplierAdvisor® yet."
              actionHref="/dashboard/suppliers/discover"
              actionLabel="Discover suppliers"
            />
          ) : view === 'board' ? (
            <SrmBoard
              columns={SUPPLIER_BOARD_COLUMNS.map((id) => ({
                id,
                label: id,
              }))}
              items={visible}
              columnOf={(s) => supplierBoardColumn(s.status)}
              renderItem={(s) => (
                <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <button
                    type="button"
                    onClick={() => selectSupplier(s)}
                    className={`${srmFocus} w-full text-left`}
                  >
                    <div className="truncate font-bold text-slate-900">{s.trading_name}</div>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Trust {Number(s.trust_score || 0).toFixed(0)} · OTIFEF{' '}
                      {Number(s.otifef_pct || 0).toFixed(0)}%
                    </div>
                  </button>
                </article>
              )}
            />
          ) : view === 'table' ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Place</th>
                    <th className="px-4 py-3">Trust</th>
                    <th className="px-4 py-3">OTIFEF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((s) => (
                    <tr key={s.id} className={selectedId === s.id ? 'bg-sky-50/80' : undefined}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => selectSupplier(selectedId === s.id ? null : s)}
                          className={`${srmFocus} text-left font-semibold text-slate-900 hover:text-[#0077b6]`}
                        >
                          {s.trading_name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${srmStatusClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{Number(s.trust_score || 0).toFixed(0)}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-[#0077b6]">
                        {Number(s.otifef_pct || 0).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => {
                const canInvite =
                  !s.linked_profile_id &&
                  s.invite_status !== 'accepted' &&
                  Boolean(s.email);
                const isSelected = selectedId === s.id;
                const card = supplierDossier(s);
                return (
                  <li key={s.id}>
                    <ProfileCard
                      name={s.trading_name}
                      detail={
                        s.legal_name && s.legal_name !== s.trading_name
                          ? s.legal_name
                          : s.contact_name
                      }
                      meta={[s.industry, s.city, s.country].filter(Boolean).join(' · ')}
                      logoUrl={
                        s.logo_url ||
                        (s as { linked_logo_url?: string | null }).linked_logo_url
                      }
                      selected={isSelected}
                      onSelect={() => selectSupplier(isSelected ? null : s)}
                      stats={card.stats}
                      chips={[
                        {
                          label: s.status || 'prospect',
                          className: srmStatusClass(s.status),
                        },
                        {
                          label: (s.invite_status || 'not invited').replace(/_/g, ' '),
                          className: inviteStatusClass(s.invite_status),
                        },
                        ...(s.verified
                          ? [{ label: 'Verified', className: 'bg-emerald-50 text-emerald-800' }]
                          : []),
                        ...(s.connection_suspended
                          ? [{ label: 'Suspended', className: 'bg-amber-50 text-amber-900' }]
                          : []),
                      ]}
                      footer={
                        <>
                          {canInvite ? (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => void invite(s)}
                              className={`${srmFocus} inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#00b4d8] bg-[#00b4d8] px-3 text-xs font-bold text-slate-950 disabled:opacity-50`}
                            >
                              {busyId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                              Invite
                            </button>
                          ) : null}
                          {s.status !== 'archived' ? (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => void remove(s)}
                              className={`${srmFocus} inline-flex min-h-11 items-center gap-1.5 rounded-full border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50`}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          ) : null}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {selected && dossier ? (
          <ProfileSheet
            dossier={dossier}
            actions={profileActions}
            onClose={() => selectSupplier(null)}
          >
            <SupplierBookProfile
              embedded
              supplier={selected}
              companyId={companyId}
              privyUserId={privyUserId}
              party={partyBySupplier[selected.id] || null}
              onClose={() => selectSupplier(null)}
              onSaved={(next) => {
                setSelectedHold(next);
                setRows((prev) =>
                  prev.map((row) => (row.id === next.id ? { ...row, ...next } : row))
                );
                if (isSrmPreviewId(next.id)) return;
                void (async () => {
                  const params = new URLSearchParams({
                    companyId: String(companyId),
                    id: String(next.id),
                  });
                  const res = await fetch(`/api/suppliers?${params}`);
                  const data = await res.json();
                  const found = ((data.suppliers || []) as SrmSupplierRecord[])[0];
                  if (found) {
                    setSelectedHold(found);
                    setRows((prev) =>
                      prev.map((row) => (row.id === found.id ? { ...row, ...found } : row))
                    );
                  }
                  void load();
                })();
              }}
            />
          </ProfileSheet>
        ) : null}
        </div>
      </div>
    </SuppliersPage>
  );
}
