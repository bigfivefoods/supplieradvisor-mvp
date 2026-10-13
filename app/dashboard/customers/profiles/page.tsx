'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
  Globe,
  FileText,
  Receipt,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  canInviteCustomer,
  customerInviteActionLabel,
  customerInviteStatusClass,
  customerInviteStatusLabel,
  formatMoney,
  resolveCustomerConnectionPhase,
  type CustomerRecord,
} from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import type { PartyRoleRow } from '@/lib/accounting/party-roles';
import { glCodeFromMeta } from '@/lib/accounting/party-roles';
import { PartyBookRoleSelect } from '@/components/accounting/PartyBookRoleSelect';
import { HostCommercial } from '@/components/commercial/CommercialPanel';
import { CURRENCIES, DEFAULT_PAYMENT_TERMS_OPTIONS } from '@/lib/business/types';
import {
  CrmEmpty,
  CrmKeysHint,
  CrmSampleBanner,
  CrmSkeleton,
  CrmTimeline,
  useCrmKeys,
} from '@/components/customers/crm/kit';
import {
  CRM_SAMPLE_FLAG,
  crmPreviewBook,
  crmPreviewCommerce,
  customerActivity,
  isCrmPreviewId,
  sortCrmRows,
} from '@/lib/customers/crm-preview';
import { ProfileCard } from '@/components/relationship/ProfileCard';
import { CardFilterBar } from '@/components/relationship/CardFilterBar';
import {
  CUSTOMER_STATUS_ORDER,
    cardQueryFromParams,
    cardQueryKey,
    customerMatches,
    emptyCardQuery,
    facetChoices,
    industryLabel,
    orderedStatuses,
    placeLabel,
    resultCount,
    sortFromParams,
    splitPrimary,
    titleLabel,
    writeListParams,
  type CardQuery,
} from '@/lib/relationship/card-filter';
import { EMPTY_FIELD } from '@/lib/relationship/profile-dossier';
import { ProfileSheet, type SheetAction } from '@/components/relationship/ProfileSheet';
import {
  customerDossier,
  customerLedgerLines,
  type DossierLine,
} from '@/lib/relationship/profile-dossier';

function sampleBookOn() {
  try {
    return sessionStorage.getItem(CRM_SAMPLE_FLAG) === '1';
  } catch {
    return false;
  }
}

function blockSampleWrite(id: number) {
  if (!isCrmPreviewId(id)) return false;
  toast.message('Sample book — nothing is saved on SupplierAdvisor®');
  return true;
}

export default function CustomerProfilesPage({
  preview,
}: {
  preview?: { companyId: number; id: number | null; query?: CardQuery; sort?: string };
} = {}) {
  if (preview) {
    return (
      <CompanyRequired assumedCompanyId={preview.companyId}>
        <ProfilesInner
          urlId={preview.id ?? 0}
          assumedCompanyId={preview.companyId}
          initialQuery={preview.query || emptyCardQuery()}
          initialSort={preview.sort || 'name'}
        />
      </CompanyRequired>
    );
  }
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <CustomersPage>
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
            </div>
          </CustomersPage>
        }
      >
        <ProfilesFromSearch />
      </Suspense>
    </CompanyRequired>
  );
}

const CUSTOMER_SORTS = ['name', 'city', 'status'] as const;

function ProfilesFromSearch() {
  const searchParams = useSearchParams();
  const urlId = Number(searchParams.get('id') || 0);
  return (
    <ProfilesInner
      urlId={Number.isFinite(urlId) ? urlId : 0}
      initialQuery={cardQueryFromParams(searchParams)}
      initialSort={sortFromParams(searchParams, CUSTOMER_SORTS)}
    />
  );
}

function ProfilesInner({
  urlId,
  assumedCompanyId,
  initialQuery,
  initialSort = 'name',
}: {
  urlId: number;
  assumedCompanyId?: number;
  initialQuery?: CardQuery;
  initialSort?: string;
}) {
  const companyId = assumedCompanyId ?? getSelectedCompanyId()!;
  const previewMode = assumedCompanyId != null;
  const seededCustomers = previewMode ? crmPreviewBook().customers : [];
  const seedId = Number.isFinite(urlId) && urlId !== 0 ? urlId : null;
  const seedCustomer =
    previewMode && seedId ? seededCustomers.find((row) => row.id === seedId) || null : null;
  const seedPack =
    previewMode && seedId && isCrmPreviewId(seedId) ? crmPreviewCommerce(seedId) : null;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(seedId);
  const [customers, setCustomers] = useState<CustomerRecord[]>(seededCustomers);
  const [loading, setLoading] = useState(!previewMode);
  const [query, setQuery] = useState<CardQuery>(initialQuery || emptyCardQuery());
  const [inviteOpenId, setInviteOpenId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [partyByCustomer, setPartyByCustomer] = useState<
    Record<number, PartyRoleRow>
  >({});
  const [commercialId, setCommercialId] = useState<number | null>(null);
  const [bookHold, setBookHold] = useState<CustomerRecord | null>(seedCustomer);
  const [bookMiss, setBookMiss] = useState(false);
  const [sort, setSort] = useState(initialSort);
  const [layout, setLayout] = useState<'list' | 'table'>('list');
  const [sample, setSample] = useState(previewMode);
  const [lines, setLines] = useState<DossierLine[]>(
    seedPack
      ? customerLedgerLines({
          quotes: seedPack.quotes,
          orders: seedPack.orders,
          invoices: seedPack.invoices,
          customerId: seedId || 0,
        })
      : []
  );
  const [openAr, setOpenAr] = useState<number | null>(seedPack ? seedPack.openAr : null);
  const [ledgerState, setLedgerState] = useState<'ready' | 'loading' | 'error'>('ready');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (Number.isFinite(urlId) && urlId !== 0) setSelectedId(urlId);
  }, [urlId]);

  const queryRef = useRef(initialQuery);
  queryRef.current = initialQuery;
  const incomingKey = cardQueryKey(initialQuery || emptyCardQuery());
  useEffect(() => {
    if (queryRef.current) setQuery(queryRef.current);
    setSort(initialSort);
  }, [incomingKey, initialSort]);

  const selectCustomer = (id: number | null) => {
    setBookHold(null);
    setBookMiss(false);
    setSelectedId(id);
    if (id !== commercialId) setCommercialId(null);
    const onWalkthrough =
      previewMode ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/crm'));
    if (onWalkthrough) {
      const next = new URLSearchParams(window.location.search);
      next.set('screen', 'profiles');
      if (id) next.set('id', String(id));
      else next.delete('id');
      router.replace(`/preview/crm?${next.toString()}`, { scroll: false });
      return;
    }
    const next = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (id) next.set('id', String(id));
    else next.delete('id');
    const qs = next.toString();
    router.replace(`/dashboard/customers/profiles${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  };

  const load = useCallback(async () => {
    const onPreview =
      previewMode ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/crm'));
    if (sampleBookOn() || onPreview) {
      setSample(sampleBookOn() || previewMode);
      setCustomers(crmPreviewBook().customers);
      setPartyByCustomer({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setSample(false);
    try {
      const params = new URLSearchParams({ companyId: String(companyId), limit: '100' });
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
      try {
        const partyRes = await fetch(
          `/api/accounting/parties?companyId=${companyId}`
        );
        const partyData = await partyRes.json();
        const idx: Record<number, PartyRoleRow> = {};
        for (const row of (partyData.parties || []) as PartyRoleRow[]) {
          if (row.customer_id) idx[row.customer_id] = row;
        }
        setPartyByCustomer(idx);
      } catch {
        setPartyByCustomer({});
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, previewMode]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    if (isCrmPreviewId(selectedId)) {
      const found = crmPreviewBook().customers.find((row) => row.id === selectedId) || null;
      setBookHold(found);
      setBookMiss(!found);
      return;
    }
    let cancelled = false;
    setBookMiss(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/customers?companyId=${companyId}&id=${selectedId}`
        );
        const data = await res.json();
        const found = ((data.customers || []) as CustomerRecord[])[0];
        if (cancelled) return;
        if (data.book && found && Number(found.id) === selectedId) setBookHold(found);
        else setBookMiss(true);
      } catch {
        if (!cancelled) setBookMiss(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedId]);

  const issuePortal = async (c: CustomerRecord) => {
    if (blockSampleWrite(c.id)) return;
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setActionId(c.id);
    try {
      const res = await fetch('/api/portals/trade/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind: 'customer',
          action: 'issue_account',
          customer_id: c.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not issue portal');
      if (data.url) {
        try {
          await navigator.clipboard.writeText(String(data.url));
        } catch {
          /* ignore */
        }
      }
      toast.success(
        data.existing
          ? 'Portal already live — link copied'
          : data.emailSent
            ? 'Customer portal issued — email sent, link copied'
            : 'Customer portal issued — link copied'
      );
      if (data.warning) toast.message(data.warning);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const remove = async (id: number) => {
    if (blockSampleWrite(id)) return;
    if (!confirm('Delete this customer?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Failed');
    }
  };

  const clearCreditHold = async (c: CustomerRecord) => {
    if (blockSampleWrite(c.id)) return;
    const reset = confirm(
      `Clear credit hold for ${c.trading_name}? OK = clear hold only. Cancel = abort.\n\nAfter OK you can choose to also reset override counter.`
    );
    if (!reset) return;
    const resetOverrides = confirm('Also reset override counter to zero?');
    setActionId(c.id);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          companyId,
          privyUserId,
          action: 'clear_credit_hold',
          resetOverrides,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Credit hold cleared');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const inviteCustomersWithEmail = async () => {
    const withEmail = customers.filter(
      (c) => (c.email || c.invited_email || '').includes('@')
    );
    if (!withEmail.length) {
      toast.message('No customers with email in this list');
      return;
    }
    const ok = confirm(
      `Invite ${withEmail.length} customer(s) with email via SupplierAdvisor invite emails?`
    );
    if (!ok) return;
    setActionId(-1);
    try {
      const emails = withEmail
        .map((c) => String(c.email || c.invited_email || '').toLowerCase())
        .filter((e) => e.includes('@'));
      const res = await fetch('/api/business/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bulk_from_emails',
          emails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(`Sent ${data.sent || 0} invite(s)`, {
        description: data.failed?.length
          ? `${data.failed.length} failed`
          : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const setSuspended = async (c: CustomerRecord, suspend: boolean) => {
    if (blockSampleWrite(c.id)) return;
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    const label = suspend ? 'Suspend' : 'Unsuspend';
    if (
      !confirm(
        suspend
          ? `Suspend platform collaboration with ${c.trading_name}? They keep historical access; new POs and shares are blocked.`
          : `Restore platform collaboration with ${c.trading_name}?`
      )
    ) {
      return;
    }
    setActionId(c.id);
    try {
      const res = await fetch(
        suspend ? '/api/customers/invites/suspend' : '/api/customers/invites/unsuspend',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            customerId: c.id,
            privyUserId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${label} failed`);
      toast.success(data.message || (suspend ? 'Suspended' : 'Unsuspended'));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActionId(null);
    }
  };

  const listRow = customers.find((c) => c.id === selectedId) || null;
  const selected =
    bookHold && bookHold.id === selectedId
      ? { ...(listRow || {}), ...bookHold }
      : listRow;
  const visible = useMemo(() => {
    let rows = customers.filter((row) => customerMatches(row, query));
    const pick = (c: CustomerRecord) =>
      sort === 'city' ? c.city || '' : sort === 'status' ? c.status || '' : c.trading_name || '';
    return sortCrmRows(rows, pick);
  }, [customers, query, sort]);

  const publishList = (nextQuery: CardQuery, nextSort = sort) => {
    setQuery(nextQuery);
    setSort(nextSort);
    if (typeof window === 'undefined') return;
    const params = writeListParams(new URLSearchParams(window.location.search), nextQuery, nextSort);
    const onWalkthrough =
      previewMode || window.location.pathname.startsWith('/preview/crm');
    if (onWalkthrough) params.set('screen', 'profiles');
    const path = onWalkthrough ? '/preview/crm' : '/dashboard/customers/profiles';
    const qs = params.toString();
    router.replace(`${path}${qs ? `?${qs}` : ''}`, { scroll: false });
  };
  const statusSplit = splitPrimary(
    orderedStatuses(
      customers.map((row) => row.status),
      CUSTOMER_STATUS_ORDER
    )
  );
  const regionChoices = facetChoices(
    customers.map((row) => placeLabel(row)),
    query.region
  );
  const industryChoices = facetChoices(
    customers.map((row) => industryLabel(row)),
    query.industry
  );

  useEffect(() => {
    if (!selectedId) {
      setLines([]);
      setOpenAr(null);
      setLedgerState('ready');
      return;
    }
    if (isCrmPreviewId(selectedId)) {
      const pack = crmPreviewCommerce(selectedId);
      setLines(
        customerLedgerLines({
          quotes: pack.quotes,
          orders: pack.orders,
          invoices: pack.invoices,
          customerId: selectedId,
        })
      );
      setOpenAr(pack.openAr);
      setLedgerState('ready');
      return;
    }
    let cancelled = false;
    setLedgerState('loading');
    void (async () => {
      try {
        const base = `/api/customers/docs?companyId=${companyId}&customerId=${selectedId}&limit=6`;
        const [quotesRes, ordersRes, invoicesRes, balanceRes] = await Promise.all([
          fetch(`${base}&type=quote`),
          fetch(`${base}&type=order`),
          fetch(`${base}&type=invoice`),
          fetch(`/api/core/customer-360?companyId=${companyId}&customerId=${selectedId}`),
        ]);
        const [quotes, orders, invoices, balance] = await Promise.all([
          quotesRes.json(),
          ordersRes.json(),
          invoicesRes.json(),
          balanceRes.json(),
        ]);
        if (cancelled) return;
        setLines(
          customerLedgerLines({
            quotes: quotes.documents,
            orders: orders.documents,
            invoices: invoices.documents,
            customerId: selectedId,
          })
        );
        const row = ((balance.rows || []) as Array<{ customer_id?: number; open_ar?: number }>).find(
          (item) => Number(item.customer_id) === selectedId
        );
        setOpenAr(row && row.open_ar != null ? Number(row.open_ar) : null);
        setLedgerState(quotesRes.ok || ordersRes.ok || invoicesRes.ok ? 'ready' : 'error');
      } catch {
        if (!cancelled) {
          setLines([]);
          setOpenAr(null);
          setLedgerState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedId]);

  useCrmKeys({
    onSearch: () => searchRef.current?.focus(),
    onCreate: () => {
      window.location.assign('/dashboard/customers/onboard');
    },
    onEscape: () => selectCustomer(null),
    onNext: () => {
      if (!visible.length) return;
      const index = visible.findIndex((c) => c.id === selectedId);
      const next = visible[index < 0 ? 0 : Math.min(visible.length - 1, index + 1)];
      if (next) selectCustomer(next.id);
    },
    onPrev: () => {
      if (!visible.length) return;
      const index = visible.findIndex((c) => c.id === selectedId);
      const prev = visible[index <= 0 ? 0 : index - 1];
      if (prev) selectCustomer(prev.id);
    },
  });

  const bookReady = Boolean(bookHold && selected && bookHold.id === selected.id);

  const mergeSaved = (saved: CustomerRecord) => {
    setBookHold(saved);
    setCustomers((prev) =>
      prev.map((row) => (row.id === saved.id ? { ...row, ...saved } : row))
    );
  };

  const onWalkthrough = previewMode;
  const party = selected ? partyByCustomer[selected.id] : undefined;
  const dossier = selected
    ? customerDossier(selected, {
        lines,
        openAr,
        ledgerState,
        activity: customerActivity({
          name: selected.trading_name,
          created_at: selected.created_at,
          updated_at: selected.updated_at,
          notes: selected.notes,
          invite_status: selected.invite_status,
          contact_name: selected.contact_name,
          city: selected.city,
        }).map((item) => ({
          id: item.id,
          at: item.at,
          title: item.title,
          detail: item.detail,
        })),
        books: party
          ? {
              role: party.role,
              ar: party.ar_account_code,
              ap: party.ap_account_code,
            }
          : undefined,
      })
    : null;
  const connection = selected ? resolveCustomerConnectionPhase(selected) : null;
  const profileActions: SheetAction[] = selected
    ? [
        {
          id: '360',
          label: 'Open Customer 360',
          href: onWalkthrough
            ? `/preview/crm?screen=360&id=${selected.id}`
            : `/dashboard/customers/360?id=${selected.id}`,
          tone: 'primary',
        },
        {
          id: 'quote',
          label: 'Quote',
          href: `/dashboard/customers/quotes?customerId=${selected.id}`,
        },
        {
          id: 'order',
          label: 'Order',
          href: `/dashboard/customers/orders?customerId=${selected.id}`,
        },
        {
          id: 'invoice',
          label: 'Invoice',
          href: `/dashboard/customers/invoices?customerId=${selected.id}`,
        },
        {
          id: 'record',
          label: 'Full record',
          href: `/dashboard/customers/onboard?id=${selected.id}`,
        },
        ...(canInviteCustomer(selected)
          ? [
              {
                id: 'invite',
                label: customerInviteActionLabel(selected),
                onClick: () => setInviteOpenId(selected.id),
              } satisfies SheetAction,
            ]
          : []),
        {
          id: 'portal',
          label: 'Portal',
          onClick: () => void issuePortal(selected),
          disabled: actionId === selected.id || !privyUserId,
        },
        {
          id: 'commercial',
          label: commercialId === selected.id ? 'Hide commercial' : 'Commercial',
          onClick: () =>
            setCommercialId((cur) => (cur === selected.id ? null : selected.id)),
        },
        ...(connection === 'accepted'
          ? [
              {
                id: 'suspend',
                label: 'Suspend',
                onClick: () => void setSuspended(selected, true),
                disabled: actionId === selected.id || !privyUserId,
              } satisfies SheetAction,
            ]
          : []),
        ...(connection === 'suspended'
          ? [
              {
                id: 'restore',
                label: 'Restore',
                onClick: () => void setSuspended(selected, false),
                disabled: actionId === selected.id || !privyUserId,
              } satisfies SheetAction,
            ]
          : []),
        {
          id: 'delete',
          label: 'Delete',
          tone: 'danger',
          onClick: () => void remove(selected.id),
        },
      ]
    : [];

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer book"
        description="One customer record on SupplierAdvisor®. Save it here and quotes, orders, and invoices use that same row."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void inviteCustomersWithEmail()}
              disabled={actionId === -1}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              {actionId === -1 ? 'Inviting…' : 'Invite all with email'}
            </button>
            <Link
              href="/dashboard/customers/invites"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              Invites
            </Link>
            <Link
              href="/dashboard/network-invites"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Invite CRM
            </Link>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add customer
            </Link>
          </div>
        }
      />

      <CrmKeysHint />
      {sample ? (
        <CrmSampleBanner
          onHide={() => {
            try {
              sessionStorage.removeItem(CRM_SAMPLE_FLAG);
            } catch {
              /* ignore */
            }
            void load();
          }}
        />
      ) : null}
      <CardFilterBar
        query={query}
        onQuery={(next) => publishList(next)}
        count={resultCount(visible.length, customers.length, 'customer')}
        noun="customer"
        searchLabel="Search customers"
        placeholder="Search name, email, city…"
        inputRef={searchRef}
        statuses={statusSplit.primary}
        moreStatuses={statusSplit.more}
        regions={regionChoices}
        industries={industryChoices}
        sort={{
          value: sort,
          onChange: (value) => publishList(query, value),
          options: [
            { value: 'name', label: 'Name' },
            { value: 'city', label: 'City' },
            { value: 'status', label: 'Status' },
          ],
        }}
        view={{
          value: layout,
          onChange: (value) => setLayout(value as 'list' | 'table'),
          options: [
            { value: 'list', label: 'Cards' },
            { value: 'table', label: 'Table' },
          ],
        }}
      />

      <div>
        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <CrmSkeleton />
          </div>
        ) : customers.length === 0 ? (
          <CrmEmpty
            icon={Users}
            title="No customers in this view"
            body="Onboard the first account, or preview a sample book. The sample never writes to the SupplierAdvisor® database."
            action={
              <Link href="/dashboard/customers/onboard" className="btn-primary !px-5 !py-2.5 text-sm">
                Add customer
              </Link>
            }
            onSample={() => {
              try {
                sessionStorage.setItem(CRM_SAMPLE_FLAG, '1');
              } catch {
                /* ignore */
              }
              void load();
            }}
          />
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-lg font-black text-slate-950">No customers match</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Nothing in the book fits these filters. Clear them to see every customer.
            </p>
            <button
              type="button"
              onClick={() => publishList(emptyCardQuery())}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#00b4d8] px-5 text-sm font-bold text-slate-950"
            >
              Clear filters
            </button>
          </div>
        ) : layout === 'table' ? (
          <div className="overflow-x-auto rounded-3xl border border-neutral-200 bg-white">
            <table className="crm-table w-full text-sm">
              <thead className="border-b text-left text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">City</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    className={selectedId === c.id ? 'bg-sky-50/80' : 'hover:bg-neutral-50'}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="min-h-11 text-left font-semibold text-slate-900"
                        onClick={() => selectCustomer(c.id)}
                      >
                        {c.trading_name}
                      </button>
                      <div className="text-xs text-slate-600">{c.contact_name || c.email || '—'}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{c.city || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${customerStatusClass(c.status)}`}>
                        {(c.status || 'active').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{c.payment_terms || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => {
              const isSelected = selectedId === c.id;
              const held =
                String(c.notes || '').includes('[credit hold]') ||
                String(c.status || '').toLowerCase() === 'credit_hold';
              const cardStats = [
                {
                  label: 'Credit',
                  value:
                    c.credit_limit != null
                      ? formatMoney(c.credit_limit, c.currency || 'ZAR')
                      : EMPTY_FIELD,
                },
                { label: 'Terms', value: c.payment_terms || EMPTY_FIELD },
                {
                  label: 'Rating',
                  value: c.rating != null ? Number(c.rating).toFixed(1) : EMPTY_FIELD,
                },
              ];
              return (
                <li key={c.id}>
                  <ProfileCard
                    name={c.trading_name}
                    kicker={c.industry}
                    detail={
                      c.legal_name && c.legal_name !== c.trading_name ? c.legal_name : c.contact_name
                    }
                    meta={[c.city, c.country].filter(Boolean).join(', ')}
                    logoUrl={c.logo_url}
                    selected={isSelected}
                    onSelect={() => selectCustomer(isSelected ? null : c.id)}
                    stats={cardStats}
                    chips={[
                      {
                        label: titleLabel(c.status || 'active'),
                        className: customerStatusClass(c.status),
                      },
                      {
                        label: customerInviteStatusLabel(c.invite_status, c.linked_profile_id),
                        className: customerInviteStatusClass(c.invite_status, c.linked_profile_id),
                      },
                      ...(held
                        ? [{ label: 'Credit hold', className: 'bg-rose-50 text-rose-800' }]
                        : []),
                    ]}
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
          onClose={() => selectCustomer(null)}
        >
          {commercialId === selected.id ? (
            <HostCommercial
              companyId={companyId}
              partyKind="customer"
              customerId={selected.id}
              partyName={selected.trading_name || 'Customer'}
            />
          ) : null}
          {inviteOpenId === selected.id && canInviteCustomer(selected) ? (
            <InviteCustomerButton
              key={selected.id}
              customerId={selected.id}
              customerName={selected.trading_name}
              defaultEmail={selected.email || selected.invited_email || ''}
              defaultContactName={selected.contact_name || ''}
              defaultOpen
              resend={
                selected.invite_status === 'invited' ||
                selected.invite_status === 'declined' ||
                selected.invite_status === 'expired'
              }
              onCancel={() => setInviteOpenId(null)}
              onSent={() => {
                setInviteOpenId(null);
                void load();
              }}
            />
          ) : null}
          <CustomerAccountPanel
            embedded
            customer={selected}
            companyId={companyId}
            privyUserId={privyUserId}
            party={partyByCustomer[selected.id]}
            busy={actionId === selected.id}
            inviting={inviteOpenId === selected.id}
            commercialOpen={commercialId === selected.id}
            bookReady={bookReady}
            bookMiss={bookMiss}
            onClose={() => selectCustomer(null)}
            onSaved={mergeSaved}
            onChanged={() => void load()}
            onToggleCommercial={() =>
              setCommercialId((cur) => (cur === selected.id ? null : selected.id))
            }
            onInvite={() => setInviteOpenId(selected.id)}
            onCancelInvite={() => setInviteOpenId(null)}
            onInvited={() => {
              setInviteOpenId(null);
              void load();
            }}
            onPortal={() => void issuePortal(selected)}
            onSuspend={(suspend) => void setSuspended(selected, suspend)}
            onClearHold={() => void clearCreditHold(selected)}
            onDelete={() => void remove(selected.id)}
          />
        </ProfileSheet>
      ) : null}
    </CustomersPage>
  );
}

function customerStatusClass(status?: string | null) {
  const s = (status || 'active').toLowerCase();
  if (s === 'on_hold' || s === 'credit_hold') return 'bg-rose-50 text-rose-800';
  if (s === 'inactive') return 'bg-neutral-100 text-neutral-600';
  if (s === 'prospect') return 'bg-amber-50 text-amber-900';
  return 'bg-emerald-50 text-emerald-800';
}

type BookForm = {
  trading_name: string;
  legal_name: string;
  contact_name: string;
  email: string;
  phone: string;
  customer_type: string;
  status: string;
  industry: string;
  vat_number: string;
  billing_address: string;
  city: string;
  country: string;
  currency: string;
  payment_terms: string;
  credit_limit: string;
  notes: string;
};

function bookFormFrom(c: CustomerRecord): BookForm {
  return {
    trading_name: c.trading_name || '',
    legal_name: c.legal_name || '',
    contact_name: c.contact_name || '',
    email: c.email || '',
    phone: c.phone || '',
    customer_type: c.customer_type || 'business',
    status: c.status || 'active',
    industry: c.industry || '',
    vat_number: c.vat_number || '',
    billing_address: c.billing_address || '',
    city: c.city || '',
    country: c.country || '',
    currency: c.currency || 'ZAR',
    payment_terms: c.payment_terms || 'Net 30',
    credit_limit:
      c.credit_limit != null && Number(c.credit_limit) > 0
        ? String(c.credit_limit)
        : '',
    notes: c.notes || '',
  };
}

const STATUS_OPTIONS = ['active', 'prospect', 'inactive', 'on_hold'];

function CustomerAccountPanel({
  customer: c,
  companyId,
  privyUserId,
  party,
  busy,
  inviting,
  commercialOpen,
  bookReady,
  bookMiss,
  onClose,
  onSaved,
  onChanged,
  onToggleCommercial,
  onInvite,
  onCancelInvite,
  onInvited,
  onPortal,
  onSuspend,
  onClearHold,
  onDelete,
  embedded = false,
}: {
  customer: CustomerRecord;
  companyId: number;
  privyUserId: string | null;
  party?: PartyRoleRow;
  busy: boolean;
  inviting: boolean;
  commercialOpen: boolean;
  bookReady: boolean;
  bookMiss: boolean;
  onClose: () => void;
  onSaved: (customer: CustomerRecord) => void;
  onChanged: () => void;
  onToggleCommercial: () => void;
  onInvite: () => void;
  onCancelInvite: () => void;
  onInvited: () => void;
  onPortal: () => void;
  onSuspend: (suspend: boolean) => void;
  onClearHold: () => void;
  onDelete: () => void;
  embedded?: boolean;
}) {
  const phase = resolveCustomerConnectionPhase(c);
  const held =
    String(c.notes || '').includes('[credit hold]') ||
    String(c.status || '').toLowerCase() === 'credit_hold';
  const [form, setForm] = useState<BookForm>(() => bookFormFrom(c));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bookReady) return;
    setForm(bookFormFrom(c));
  }, [bookReady, c.id, c.updated_at]);

  const set = (key: keyof BookForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (blockSampleWrite(c.id)) return;
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    if (form.credit_limit.trim() && !Number.isFinite(Number(form.credit_limit))) {
      toast.error('Credit limit must be a number');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          companyId,
          privyUserId: privyUserId || undefined,
          trading_name: form.trading_name.trim(),
          legal_name: form.legal_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          customer_type: form.customer_type,
          ...(held ? {} : { status: form.status }),
          industry: form.industry,
          vat_number: form.vat_number,
          billing_address: form.billing_address,
          city: form.city,
          country: form.country,
          currency: form.currency,
          payment_terms: form.payment_terms,
          credit_limit: form.credit_limit.trim() === '' ? null : Number(form.credit_limit),
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const saved = (data.customer || null) as CustomerRecord | null;
      toast.success('Saved to the customer book');
      onSaved(saved && saved.id ? saved : { ...c, ...form, credit_limit: numericCredit(form.credit_limit) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const terms = form.payment_terms &&
    !(DEFAULT_PAYMENT_TERMS_OPTIONS as readonly string[]).includes(form.payment_terms)
    ? [form.payment_terms, ...DEFAULT_PAYMENT_TERMS_OPTIONS]
    : [...DEFAULT_PAYMENT_TERMS_OPTIONS];
  const currencies = (CURRENCIES as readonly string[]).includes(form.currency)
    ? CURRENCIES
    : [form.currency, ...CURRENCIES];
  const statuses = STATUS_OPTIONS.includes(form.status)
    ? STATUS_OPTIONS
    : [form.status, ...STATUS_OPTIONS];

  const Root = embedded ? 'details' : 'aside';
  return (
    <Root
      className={
        embedded
          ? 'rounded-3xl border border-slate-200 bg-white'
          : 'rounded-[1.5rem] border border-neutral-200 bg-white p-4 shadow-sm lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto'
      }
    >
      {embedded ? (
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-slate-950">
          Edit this record
          <span className="text-xs font-semibold text-slate-500">Quotes copy these terms</span>
        </summary>
      ) : null}
      <div className={embedded ? 'border-t border-slate-100 p-4' : ''}>
      {!embedded ? (
      <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
            Account
          </p>
          <h2 className="truncate text-lg font-black tracking-tight text-slate-900">
            {form.trading_name || c.trading_name}
          </h2>
          <p className="text-xs text-neutral-500">
            One database record. Quotes and invoices copy the terms and currency saved here.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold text-neutral-600 hover:text-slate-900"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerStatusClass(c.status)}`}>
          {(c.status || 'active').replace(/_/g, ' ')}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerInviteStatusClass(c.invite_status, c.linked_profile_id)}`}
        >
          {customerInviteStatusLabel(c.invite_status, c.linked_profile_id)}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
          {(c.customer_type || 'business').replace(/_/g, ' ')}
        </span>
      </div>
      </>
      ) : null}

      <AccountLogoField
        companyId={companyId}
        privyUserId={privyUserId}
        kind="customer"
        recordId={c.id}
        logoUrl={c.logo_url}
        name={form.trading_name || c.trading_name}
        size="lg"
        onChange={(url) => onSaved({ ...c, logo_url: url })}
      />

      {bookReady ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 [&_input]:min-h-11 [&_select]:min-h-11">
          <BookField label="Trading name *">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.trading_name}
              onChange={(e) => set('trading_name', e.target.value)}
            />
          </BookField>
          <BookField label="Legal name">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.legal_name}
              onChange={(e) => set('legal_name', e.target.value)}
            />
          </BookField>
          <BookField label="Contact">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
            />
          </BookField>
          <BookField label="Email">
            <input
              type="email"
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </BookField>
          <BookField label="Phone">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </BookField>
          <BookField label="Type">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.customer_type}
              onChange={(e) => set('customer_type', e.target.value)}
            >
              <option value="business">Business</option>
              <option value="individual">Individual</option>
              <option value="government">Government</option>
              <option value="ngo">NGO</option>
            </select>
          </BookField>
          {held ? (
            <BookField label="Status">
              <p className="mt-1 text-sm font-semibold normal-case tracking-normal text-rose-800">
                Credit hold. Press Clear to lift it.
              </p>
            </BookField>
          ) : (
            <BookField label="Status">
              <select
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </BookField>
          )}
          <BookField label="City">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </BookField>
          <BookField label="Country">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </BookField>
          <BookField label="Payment terms">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.payment_terms}
              onChange={(e) => set('payment_terms', e.target.value)}
            >
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </BookField>
          <BookField label="Currency">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {currencies.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </BookField>
          <BookField label="Credit limit">
            <input
              inputMode="decimal"
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.credit_limit}
              placeholder="No limit"
              onChange={(e) => set('credit_limit', e.target.value)}
            />
          </BookField>
          <BookField label="VAT number">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.vat_number}
              onChange={(e) => set('vat_number', e.target.value)}
            />
          </BookField>
          <BookField label="Industry" wide>
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
            />
          </BookField>
          <BookField label="Notes" wide>
            <textarea
              className="input mt-0.5 min-h-[88px] w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </BookField>
          <BookField label="Billing address" wide>
            <textarea
              className="input mt-0.5 min-h-[64px] w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.billing_address}
              onChange={(e) => set('billing_address', e.target.value)}
            />
          </BookField>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0077b6] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to customer book
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <Fact label="Contact" value={c.contact_name} />
          <Fact label="Email" value={c.email} />
          <Fact label="Phone" value={c.phone} />
          <Fact label="Location" value={[c.city, c.country].filter(Boolean).join(', ')} />
          <Fact label="Terms" value={c.payment_terms} />
          <p className="text-xs text-neutral-500">
            {bookMiss
              ? 'The saved record did not load. Use Full record to edit it.'
              : 'Loading the saved record…'}
          </p>
        </dl>
      )}

      {held ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
          <span className="text-sm font-bold text-rose-800">Credit hold</span>
          <button
            type="button"
            onClick={onClearHold}
            className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-[#0077b6]"
          >
            Clear
          </button>
        </div>
      ) : null}

      {!embedded ? (
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Activity</p>
        <div className="mt-2">
          <CrmTimeline
            items={customerActivity({
              name: c.trading_name,
              created_at: c.created_at,
              updated_at: c.updated_at,
              notes: form.notes || c.notes,
              invite_status: c.invite_status,
              contact_name: form.contact_name || c.contact_name,
              city: form.city || c.city,
            })}
          />
        </div>
      </div>
      ) : null}

      <div className="mt-4">
        <PartyBookRoleSelect
          companyId={companyId}
          customerId={c.id}
          supplierId={party?.supplier_id}
          role={party?.role || 'customer'}
          arCode={party?.ar_account_code || glCodeFromMeta(c.metadata)}
          apCode={party?.ap_account_code}
          compact
          onChanged={onChanged}
        />
        {party?.supplier_id ? (
          <Link
            href={`/dashboard/suppliers/network?id=${party.supplier_id}`}
            className="mt-1 inline-flex text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            Open supplier book
          </Link>
        ) : null}
      </div>

      {!embedded ? (
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/dashboard/customers/onboard?id=${c.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <Pencil className="h-4 w-4" /> Full record
        </Link>
        <Link
          href={`/dashboard/customers/quotes?customerId=${c.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <FileText className="h-4 w-4" /> Quote
        </Link>
        <Link
          href={`/dashboard/customers/invoices?customerId=${c.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <Receipt className="h-4 w-4" /> Invoice
        </Link>
        <Link
          href="/dashboard/customers/360"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          360
        </Link>
        <button
          type="button"
          onClick={onToggleCommercial}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/10 px-3 text-sm font-semibold text-[#0077b6]"
        >
          {commercialOpen ? 'Hide commercial' : 'Commercial'}
        </button>
        {canInviteCustomer(c) && !inviting ? (
          <button
            type="button"
            onClick={onInvite}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[#00b4d8] bg-[#00b4d8] px-3 text-sm font-semibold text-slate-950"
          >
            {customerInviteActionLabel(c)}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !privyUserId}
          onClick={onPortal}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 px-3 text-sm font-semibold text-[#0077b6] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Portal
        </button>
        {phase === 'accepted' ? (
          <button
            type="button"
            disabled={busy || !privyUserId}
            onClick={() => onSuspend(true)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-amber-200 px-3 text-sm font-semibold text-amber-800 disabled:opacity-50"
          >
            <PauseCircle className="h-4 w-4" /> Suspend
          </button>
        ) : null}
        {phase === 'suspended' ? (
          <button
            type="button"
            disabled={busy || !privyUserId}
            onClick={() => onSuspend(false)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50"
          >
            <PlayCircle className="h-4 w-4" /> Restore
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 px-3 text-sm font-semibold text-rose-700"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
      ) : null}

      {!embedded && inviting && canInviteCustomer(c) ? (
        <div className="mt-3">
          <InviteCustomerButton
            key={c.id}
            customerId={c.id}
            customerName={c.trading_name}
            defaultEmail={c.email || c.invited_email || ''}
            defaultContactName={c.contact_name || ''}
            defaultOpen
            resend={
              c.invite_status === 'invited' ||
              c.invite_status === 'declined' ||
              c.invite_status === 'expired'
            }
            onCancel={onCancelInvite}
            onSent={onInvited}
          />
        </div>
      ) : null}

      {!embedded && commercialOpen ? (
        <div className="mt-4">
          <HostCommercial
            companyId={companyId}
            partyKind="customer"
            customerId={c.id}
            partyName={c.trading_name || 'Customer'}
          />
        </div>
      ) : null}
      </div>
    </Root>
  );
}

function numericCredit(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function BookField({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label
      className={`block text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      {label}
      {children}
    </label>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="truncate text-right text-slate-800">{value || '—'}</dd>
    </div>
  );
}
