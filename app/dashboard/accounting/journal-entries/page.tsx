'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  X,
  CheckCircle2,
  Ban,
  Trash2,
  Undo2,
  Pencil,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  statusClass,
  type CoaAccount,
  type JournalEntry,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  AccountingStat,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import PeriodSlicer from '@/components/accounting/PeriodSlicer';
import { useAccountingPeriod } from '@/lib/accounting/use-period';
import { ChartCard, MixDoughnut } from '@/components/accounting/AccountingCharts';
import { FinanceWorkspaceNote } from '@/components/accounting/FinanceWorkspaceNote';
import {
  isOwnJournal,
  loadFinanceWorkspace,
  saveFinanceWorkspace,
  type JournalScope,
} from '@/lib/accounting/user-workspace';
import {
  applySuggestedAccountsToLines,
  reviewFlagKey,
  type JournalReviewFlag,
} from '@/lib/accounting/journal-review';
import { journalIsReversed } from '@/lib/accounting/journal-status';

type LineForm = {
  account_id: string;
  debit: string;
  credit: string;
  memo: string;
};

const emptyLine = (): LineForm => ({
  account_id: '',
  debit: '',
  credit: '',
  memo: '',
});

function linesFromJournal(je: JournalEntry): LineForm[] {
  const formLines = (je.lines || []).map((l) => ({
    account_id: String(l.account_id ?? ''),
    debit: Number(l.debit) > 0 ? String(l.debit) : '',
    credit: Number(l.credit) > 0 ? String(l.credit) : '',
    memo: l.memo || '',
  }));
  return formLines.length >= 2 ? formLines : [emptyLine(), emptyLine()];
}

export default function JournalEntriesPage() {
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
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { fyStartMonth, period, setPeriod } = useAccountingPeriod(
    companyId,
    privyUserId,
    'full_fy'
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [journalScope, setJournalScope] = useState<JournalScope>(() =>
    loadFinanceWorkspace(privyUserId, companyId).journalScope || 'posted_and_mine'
  );
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memo, setMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [postNow, setPostNow] = useState(false);
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()]);
  const [accountFilter, setAccountFilter] = useState('');
  const [reviewFlags, setReviewFlags] = useState<JournalReviewFlag[]>([]);
  const [reviewScanned, setReviewScanned] = useState(0);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [keepBusy, setKeepBusy] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<'keep' | 'reclassify' | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  /** create | edit_draft | edit_posted (reclassify via reverse + new) */
  const [editMode, setEditMode] = useState<{
    type: 'create' | 'edit_draft' | 'edit_posted';
    id?: number;
    label?: string;
  }>({ type: 'create' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('from', period.from);
      params.set('to', period.to);
      const [jeRes, coaRes] = await Promise.all([
        fetch(`/api/accounting/journals?${params}`),
        fetch(
          `/api/accounting/chart-of-accounts?companyId=${companyId}&balances=0${
            privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''
          }`
        ),
      ]);
      const jeData = await jeRes.json();
      const coaData = await coaRes.json();
      setEntries(jeData.entries || []);
      setAccounts(
        (coaData.accounts || []).filter(
          (a: CoaAccount) => !a.is_header && a.is_active !== false
        )
      );
      if (jeData.warning) toast.message(jeData.warning);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, statusFilter, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadReview = useCallback(async () => {
    setReviewBusy(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      params.set('from', period.from);
      params.set('to', period.to);
      const res = await fetch(`/api/accounting/journals/review?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      const flags = Array.isArray(data.flags) ? data.flags : [];
      setReviewFlags(flags);
      setReviewScanned(Number(data.scanned) || 0);
      const missingIds = [
        ...new Set(
          flags
            .map((f: JournalReviewFlag) => Number(f.journal_id))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        ),
      ].slice(0, 40);
      if (missingIds.length) {
        const extraParams = new URLSearchParams({
          companyId: String(companyId),
          ids: missingIds.join(','),
        });
        if (privyUserId) extraParams.set('privyUserId', privyUserId);
        const extraRes = await fetch(
          `/api/accounting/journals?${extraParams}`,
          { cache: 'no-store' }
        );
        const extraData = await extraRes.json();
        const extraRows = Array.isArray(extraData.entries)
          ? (extraData.entries as JournalEntry[])
          : [];
        if (extraRows.length) {
          setEntries((prev) => {
            const byId = new Map(prev.map((e) => [Number(e.id), e]));
            for (const row of extraRows) {
              if (!byId.has(Number(row.id))) byId.set(Number(row.id), row);
            }
            return Array.from(byId.values());
          });
          const reversed = new Set(
            extraRows.filter(journalIsReversed).map((e) => Number(e.id))
          );
          if (reversed.size) {
            setReviewFlags((prev) =>
              prev.filter((f) => !reversed.has(Number(f.journal_id)))
            );
          }
        }
      }
      setSelectedKeys((prev) => {
        const live = new Set(flags.map(reviewFlagKey));
        const next = new Set<string>();
        for (const k of prev) if (live.has(k)) next.add(k);
        return next;
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not review journals');
      setReviewFlags([]);
    } finally {
      setReviewBusy(false);
    }
  }, [companyId, privyUserId, period.from, period.to]);

  useEffect(() => {
    if (!reviewOpen) return;
    void loadReview();
  }, [reviewOpen, loadReview]);

  useEffect(() => {
    saveFinanceWorkspace(privyUserId, companyId, { journalScope });
  }, [privyUserId, companyId, journalScope]);

  const visibleEntries = useMemo(() => {
    if (journalScope === 'all') return entries;
    return entries.filter(
      (e) =>
        e.status === 'posted' ||
        e.status === 'void' ||
        isOwnJournal(e.created_by, privyUserId)
    );
  }, [entries, journalScope, privyUserId]);

  const balance = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += Number(l.debit || 0);
      credit += Number(l.credit || 0);
    }
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      ok: Math.abs(debit - credit) < 0.005 && debit > 0,
    };
  }, [lines]);

  const filteredAccounts = useMemo(() => {
    const q = accountFilter.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        String(a.code || '')
          .toLowerCase()
          .includes(q) ||
        String(a.name || '')
          .toLowerCase()
          .includes(q) ||
        String(a.account_type || '')
          .toLowerCase()
          .includes(q)
    );
  }, [accounts, accountFilter]);

  const selectedFlags = useMemo(
    () => reviewFlags.filter((f) => selectedKeys.has(reviewFlagKey(f))),
    [reviewFlags, selectedKeys]
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate =
      selectedKeys.size > 0 && selectedKeys.size < reviewFlags.length;
  }, [selectedKeys, reviewFlags.length, reviewOpen]);

  function openCreate() {
    setEditMode({ type: 'create' });
    setMemo('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPostNow(true);
    setLines([emptyLine(), emptyLine()]);
    setAccountFilter('');
    setShowModal(true);
  }

  const mergeEntries = useCallback((extra: JournalEntry[]) => {
    if (!extra.length) return;
    setEntries((prev) => {
      const byId = new Map(prev.map((e) => [Number(e.id), e]));
      for (const row of extra) byId.set(Number(row.id), row);
      return Array.from(byId.values());
    });
  }, []);

  const ensureJournal = useCallback(
    async (journalId: number): Promise<JournalEntry | null> => {
      const local = entries.find((e) => Number(e.id) === Number(journalId));
      if (local) return local;
      const params = new URLSearchParams({
        companyId: String(companyId),
        id: String(journalId),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/journals?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      const je = Array.isArray(data.entries)
        ? (data.entries[0] as JournalEntry | undefined)
        : undefined;
      if (je) mergeEntries([je]);
      return je || null;
    },
    [companyId, entries, mergeEntries, privyUserId]
  );

  /** Edit draft in place, or reclassify a posted entry (change COA / amounts). */
  function openEdit(je: JournalEntry) {
    const label = je.entry_number || `JE-${je.id}`;
    if (journalIsReversed(je)) {
      toast.error(
        `${label} was already reversed. Use the replacement journal (source: correction) to reclassify.`
      );
      return;
    }
    if (String(je.status) === 'draft') {
      setEditMode({ type: 'edit_draft', id: je.id, label });
      setMemo(je.memo || '');
      setEntryDate(String(je.entry_date || '').slice(0, 10));
      setPostNow(false);
      setLines(linesFromJournal(je));
      setAccountFilter('');
      setShowModal(true);
      return;
    }
    if (String(je.status) === 'posted') {
      setEditMode({ type: 'edit_posted', id: je.id, label });
      setMemo(je.memo || '');
      setEntryDate(String(je.entry_date || new Date().toISOString().slice(0, 10)).slice(0, 10));
      setPostNow(true);
      setLines(linesFromJournal(je));
      setAccountFilter('');
      setShowModal(true);
      return;
    }
    toast.error('Void journals cannot be edited');
  }

  function formLinesFromPayload(
    payload: Array<{
      account_id: number;
      debit: number;
      credit: number;
      memo?: string;
    }>
  ): LineForm[] {
    const formLines = payload.map((l) => ({
      account_id: String(l.account_id),
      debit: l.debit > 0 ? String(l.debit) : '',
      credit: l.credit > 0 ? String(l.credit) : '',
      memo: l.memo || '',
    }));
    return formLines.length >= 2 ? formLines : [emptyLine(), emptyLine()];
  }

  async function openReclassifyFromReview(flag: JournalReviewFlag) {
    const je = await ensureJournal(flag.journal_id);
    if (!je || String(je.status) !== 'posted') {
      toast.error('Could not load that journal to reclassify');
      return;
    }
    const formLines = formLinesFromPayload(
      applySuggestedAccountsToLines(je.lines || [], [flag])
    );
    setEditMode({
      type: 'edit_posted',
      id: je.id,
      label: je.entry_number || `JE-${je.id}`,
    });
    setMemo(je.memo || '');
    setEntryDate(
      String(je.entry_date || new Date().toISOString().slice(0, 10)).slice(0, 10)
    );
    setPostNow(true);
    setLines(formLines);
    setAccountFilter('');
    setShowModal(true);
  }

  function toggleReviewKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllReview() {
    setSelectedKeys((prev) => {
      if (prev.size === reviewFlags.length && reviewFlags.length > 0) {
        return new Set();
      }
      return new Set(reviewFlags.map(reviewFlagKey));
    });
  }

  async function keepPostedAccount(flag: JournalReviewFlag) {
    const key = reviewFlagKey(flag);
    setKeepBusy(key);
    try {
      const res = await fetch('/api/accounting/journals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'keep',
          journal_id: flag.journal_id,
          line_id: flag.line_id,
          posted_account_id: flag.posted_account_id,
          description: flag.description || flag.memo || flag.merchant_key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not keep');
      toast.success(
        data.message ||
          'Kept — similar lines will stay on this account'
      );
      setReviewFlags((prev) => prev.filter((f) => reviewFlagKey(f) !== key));
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      void loadReview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not keep');
    } finally {
      setKeepBusy(null);
    }
  }

  async function keepSelectedClassifications() {
    if (!selectedFlags.length) {
      toast.error('Tick the lines to keep');
      return;
    }
    setBulkBusy('keep');
    try {
      const res = await fetch('/api/accounting/journals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'keep_many',
          items: selectedFlags.map((flag) => ({
            journal_id: flag.journal_id,
            line_id: flag.line_id,
            posted_account_id: flag.posted_account_id,
            description: flag.description || flag.memo || flag.merchant_key,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not keep');
      const drop = new Set(selectedFlags.map(reviewFlagKey));
      setReviewFlags((prev) => prev.filter((f) => !drop.has(reviewFlagKey(f))));
      setSelectedKeys(new Set());
      toast.success(
        data.message ||
          `Kept ${selectedFlags.length} classification(s)`
      );
      void loadReview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not keep');
    } finally {
      setBulkBusy(null);
    }
  }

  async function reclassifySelected() {
    if (!selectedFlags.length) {
      toast.error('Tick the lines to reclassify');
      return;
    }
    const byJournal = new Map<number, JournalReviewFlag[]>();
    for (const flag of selectedFlags) {
      const list = byJournal.get(flag.journal_id) || [];
      list.push(flag);
      byJournal.set(flag.journal_id, list);
    }
    if (
      !window.confirm(
        `Reclassify ${selectedFlags.length} line(s) on ${byJournal.size} journal(s) to the suggested accounts? Each journal is reversed and a corrected entry is posted.`
      )
    ) {
      return;
    }
    setBulkBusy('reclassify');
    let ok = 0;
    let fail = 0;
    const notes: string[] = [];
    try {
      for (const [journalId, flags] of byJournal) {
        const je = await ensureJournal(journalId);
        if (!je || String(je.status) !== 'posted') {
          fail += 1;
          notes.push(`JE-${journalId} not loaded as posted`);
          continue;
        }
        const payloadLines = applySuggestedAccountsToLines(
          je.lines || [],
          flags
        ).filter((l) => l.debit > 0 || l.credit > 0);
        if (payloadLines.length < 2) {
          fail += 1;
          notes.push(
            `${je.entry_number || `JE-${journalId}`} needs two lines`
          );
          continue;
        }
        try {
          const res = await fetch('/api/accounting/journals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              privyUserId,
              id: je.id,
              action: 'reclassify',
              entry_date: String(je.entry_date || '').slice(0, 10),
              memo: je.memo,
              lines: payloadLines,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            fail += 1;
            notes.push(
              `${je.entry_number || `JE-${journalId}`}: ${data.error || 'failed'}`
            );
            continue;
          }
          ok += 1;
        } catch (e: unknown) {
          fail += 1;
          notes.push(
            `${je.entry_number || `JE-${journalId}`}: ${
              e instanceof Error ? e.message : 'failed'
            }`
          );
        }
      }
      if (ok && !fail) {
        toast.success(
          `Reclassified ${ok} journal${ok === 1 ? '' : 's'} to suggested accounts`
        );
      } else if (ok) {
        toast.message(`Reclassified ${ok}, ${fail} could not be posted`);
      } else {
        toast.error(notes[0] || 'Could not reclassify the selection');
      }
      setSelectedKeys(new Set());
      void load();
      void loadReview();
    } finally {
      setBulkBusy(null);
    }
  }

  async function saveJournal(e: React.FormEvent) {
    e.preventDefault();
    const payloadLines = lines
      .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        account_id: Number(l.account_id),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo || undefined,
      }));
    if (payloadLines.length < 2) {
      toast.error('Need at least two lines with amounts');
      return;
    }
    if ((postNow || editMode.type === 'edit_posted') && !balance.ok) {
      toast.error(`Entry must balance (D ${balance.debit} ≠ C ${balance.credit})`);
      return;
    }
    setSaving(true);
    try {
      if (editMode.type === 'edit_draft' && editMode.id) {
        const res = await fetch('/api/accounting/journals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            id: editMode.id,
            action: 'update_draft',
            entry_date: entryDate,
            memo,
            lines: payloadLines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (postNow) {
          const postRes = await fetch('/api/accounting/journals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              privyUserId,
              id: editMode.id,
              action: 'post',
            }),
          });
          const postData = await postRes.json();
          if (!postRes.ok) throw new Error(postData.error || 'Saved but post failed');
          toast.success('Draft updated and posted');
        } else {
          toast.success('Draft updated — accounts and amounts saved');
        }
      } else if (editMode.type === 'edit_posted' && editMode.id) {
        const res = await fetch('/api/accounting/journals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            id: editMode.id,
            action: 'reclassify',
            entry_date: entryDate,
            memo,
            lines: payloadLines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        toast.success(
          `Reclassified ${data.superseded || editMode.label || ''} → ${
            data.entry?.entry_number || 'new entry'
          } posted with the new accounts`
        );
      } else {
        const res = await fetch('/api/accounting/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            entry_date: entryDate,
            memo,
            status: postNow ? 'posted' : 'draft',
            lines: payloadLines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        toast.success(postNow ? 'Journal posted' : 'Draft saved');
      }
      setShowModal(false);
      setEditMode({ type: 'create' });
      setMemo('');
      setLines([emptyLine(), emptyLine()]);
      setAccountFilter('');
      void load();
      void loadReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function action(id: number, act: 'post' | 'void' | 'reverse') {
    const labels = {
      post: 'Post this draft?',
      void: 'Void this draft? Posted journals cannot be deleted — reverse them instead.',
      reverse:
        'Reverse this posted journal? A reversing entry will be posted and the original stays on the audit trail. Use Edit to reclassify to different accounts.',
    };
    if (!window.confirm(labels[act])) return;
    try {
      const res = await fetch('/api/accounting/journals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id, action: act }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        act === 'post'
          ? 'Posted'
          : act === 'void'
            ? 'Voided'
            : 'Reversed — offsetting entry posted'
      );
      void load();
      void loadReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const accountName = (id: number) => {
    const a = accounts.find((x) => Number(x.id) === Number(id));
    return a ? `${a.code} · ${a.name}` : `#${id}`;
  };

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title="Journal"
        titleAccent="entries"
        description="Create journals, edit drafts, or reclassify posted entries. The review below learns from past allocations and keywords to flag lines that may have gone to the wrong account."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            <Plus className="w-4 h-4" /> New journal
          </button>
        }
      />

      <div className="mb-4 print:hidden">
        <PeriodSlicer
          value={period}
          fyStartMonth={fyStartMonth}
          onChange={setPeriod}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="posted">Posted</option>
          <option value="draft">Draft</option>
          <option value="void">Void</option>
        </select>
        <select
          value={journalScope}
          onChange={(e) => setJournalScope(e.target.value as JournalScope)}
          className="rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
        >
          <option value="posted_and_mine">Posted + my drafts</option>
          <option value="all">Everyone’s drafts</option>
        </select>
      </div>
      <FinanceWorkspaceNote className="mb-4" />

      <div className="mb-4 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setReviewOpen((o) => !o)}
            className="inline-flex min-w-0 flex-1 items-center gap-2 text-left group"
            aria-expanded={reviewOpen}
          >
            {reviewOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-violet-700" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-violet-400 group-hover:text-violet-700" />
            )}
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-800" />
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-800">
              Allocation review
            </span>
            <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
              {reviewBusy ? '…' : reviewScanned} scanned
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${
                reviewFlags.length
                  ? 'border border-violet-300 bg-violet-100 text-violet-900'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {reviewBusy
                ? 'Scoring'
                : reviewFlags.length
                  ? `${reviewFlags.length} to check`
                  : 'Clear'}
            </span>
            {selectedKeys.size > 0 ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#0077b6]">
                {selectedKeys.size} selected
              </span>
            ) : null}
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              {reviewOpen ? 'Click to collapse' : 'Click to expand'}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void loadReview();
            }}
            disabled={reviewBusy}
            className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5 shrink-0"
          >
            {reviewBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {reviewBusy ? 'Scoring…' : 'Re-run review'}
          </button>
        </div>

        {reviewOpen ? (
          <div className="border-t border-violet-100 px-4 pb-4 pt-3">
            <p className="text-sm text-slate-600">
              Posted lines are scored against similar journals, bank allocations,
              and description keywords. Tick lines for a mass Keep or Reclassify,
              or act on one row. Keep teaches the OS this posting is right.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-violet-100 bg-white px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Lines scanned
                </p>
                <p className="text-lg font-black tabular-nums text-slate-900">
                  {reviewBusy ? '—' : reviewScanned}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-white px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Suggested checks
                </p>
                <p className="text-lg font-black tabular-nums text-slate-900">
                  {reviewBusy ? '—' : reviewFlags.length}
                </p>
              </div>
            </div>
            {reviewBusy ? (
              <p className="mt-3 text-xs text-slate-500">
                Learning from posted journals and bank allocations…
              </p>
            ) : reviewFlags.length === 0 ? (
              <p className="mt-3 text-xs text-emerald-800">
                No likely mis-posts in this period. Keep posting — the review gets
                sharper as similar descriptions repeat.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={
                        reviewFlags.length > 0 &&
                        selectedKeys.size === reviewFlags.length
                      }
                      onChange={toggleSelectAllReview}
                      disabled={!!bulkBusy}
                      aria-label="Select all suggested checks"
                    />
                    Select all
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {selectedKeys.size
                      ? `${selectedKeys.size} selected`
                      : 'Tick lines, then keep or reclassify'}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void keepSelectedClassifications()}
                      disabled={!selectedKeys.size || !!bulkBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {bulkBusy === 'keep' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Keep classification
                    </button>
                    <button
                      type="button"
                      onClick={() => void reclassifySelected()}
                      disabled={!selectedKeys.size || !!bulkBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#00b4d8]/40 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-[#0077b6] hover:bg-sky-100 disabled:opacity-50"
                    >
                      {bulkBusy === 'reclassify' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                      Reclassify to suggested
                    </button>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {reviewFlags.map((flag) => {
                    const key = reviewFlagKey(flag);
                    const selected = selectedKeys.has(key);
                    const rowBusy = keepBusy === key || !!bulkBusy;
                    return (
                      <li
                        key={key}
                        className={`rounded-xl border bg-white px-3 py-2.5 ${
                          selected
                            ? 'border-violet-300 ring-1 ring-violet-200'
                            : 'border-violet-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="mt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleReviewKey(key)}
                              disabled={!!bulkBusy}
                              aria-label={`Select ${flag.journal_number || `JE-${flag.journal_id}`}`}
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-900">
                              {flag.journal_number || `JE-${flag.journal_id}`}
                              <span className="ml-2 text-xs font-semibold text-slate-500">
                                {flag.entry_date}
                              </span>
                              <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-800">
                                {flag.confidence}%
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {flag.description || flag.memo || 'Posted line'}
                            </p>
                            <p className="mt-1 text-xs text-slate-700">
                              <span className="font-semibold">
                                {flag.posted_account_label}
                              </span>
                              {' → '}
                              <span className="font-black text-[#0077b6]">
                                {flag.suggested_account_label}
                              </span>
                              <span className="text-slate-400">
                                {' '}
                                · {formatMoney(flag.amount)} {flag.side}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {flag.reason}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void keepPostedAccount(flag)}
                              disabled={rowBusy}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {keepBusy === key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Keep account
                            </button>
                            <button
                              type="button"
                              onClick={() => void openReclassifyFromReview(flag)}
                              disabled={!!bulkBusy}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#00b4d8]/40 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-[#0077b6] hover:bg-sky-100 disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Reclassify
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="w-full border-t border-violet-100 px-4 py-2.5 text-left text-xs text-slate-600 hover:bg-violet-50/60"
          >
            {reviewBusy
              ? 'Scoring posted journals…'
              : reviewFlags.length === 0
                ? 'No likely mis-posts in this period — expand for detail'
                : 'Tick lines for a mass Keep classification or Reclassify to suggested'}
          </button>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Edit / reclassify · </strong>
        <strong>Draft</strong> → Edit (change COA accounts, amounts, memo) then save or post.{' '}
        <strong>Posted</strong> → Edit to push lines to a new COA account (system reverses the
        original and posts your corrected journal). The original stays on the
        audit trail as <strong>Reversed</strong> — the new correction JE is the live
        posting. <strong>Reverse</strong> undoes without a replacement.{' '}
        <strong>Bank/VAT</strong> → Bank recon → Unallocate → re-allocate if the
        source bank line is wrong.
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-4">
        <AccountingStat
          label="In period"
          value={String(visibleEntries.length)}
        />
        <AccountingStat
          label="Posted"
          value={String(visibleEntries.filter((e) => e.status === 'posted').length)}
        />
        <AccountingStat
          label="Period debit"
          value={formatMoney(
            visibleEntries.reduce((s, e) => s + Number(e.total_debit || 0), 0)
          )}
        />
        <AccountingStat
          label="Period credit"
          value={formatMoney(
            visibleEntries.reduce((s, e) => s + Number(e.total_credit || 0), 0)
          )}
        />
      </div>
      {visibleEntries.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 mb-4 print:hidden">
          <ChartCard title="By status" subtitle="Journals in the sliced period" height={220}>
            <MixDoughnut
              segments={['posted', 'draft', 'void'].map((st) => ({
                label: st,
                value: visibleEntries.filter((e) => e.status === st).length,
              }))}
              centerLabel="Journals"
              centerValue={String(visibleEntries.length)}
            />
          </ChartCard>
          <ChartCard title="By source" subtitle="How entries were created" height={220}>
            <MixDoughnut
              segments={Array.from(
                visibleEntries.reduce((m, e) => {
                  const k = String(e.source || 'manual');
                  m.set(k, (m.get(k) || 0) + 1);
                  return m;
                }, new Map<string, number>())
              ).map(([label, value]) => ({ label, value }))}
              centerLabel="Source"
              centerValue={String(visibleEntries.length)}
            />
          </ChartCard>
        </div>
      ) : null}

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No journal entries in this view. New journals save as your draft until you post.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {visibleEntries.map((je) => (
              <div key={je.id} className="px-4 sm:px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {je.entry_number || `JE-${je.id}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(je.status)}`}
                      >
                        {je.status}
                      </span>
                      {journalIsReversed(je) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-900">
                          Reversed
                        </span>
                      ) : null}
                      {je.source && je.source !== 'manual' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {je.source}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {je.entry_date}
                      {je.memo ? ` · ${je.memo}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-right text-xs mr-1">
                      <div className="tabular-nums font-semibold text-slate-800">
                        D {formatMoney(je.total_debit)}
                      </div>
                      <div className="tabular-nums text-neutral-500">
                        C {formatMoney(je.total_credit)}
                      </div>
                    </div>
                    {(je.status === 'draft' ||
                      (je.status === 'posted' && !journalIsReversed(je))) && (
                      <button
                        type="button"
                        title={
                          je.status === 'draft'
                            ? 'Edit draft — change accounts and amounts'
                            : 'Edit / reclassify — change COA accounts (reverse + re-post)'
                        }
                        onClick={() => openEdit(je)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#00b4d8]/40 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-[#0077b6] hover:bg-sky-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    {je.status === 'draft' && (
                      <button
                        type="button"
                        title="Post"
                        onClick={() => void action(je.id, 'post')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Post
                      </button>
                    )}
                    {je.status === 'posted' && !journalIsReversed(je) && (
                      <button
                        type="button"
                        title="Reverse only (undo without replacement)"
                        onClick={() => void action(je.id, 'reverse')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Reverse
                      </button>
                    )}
                    {je.status === 'draft' && (
                      <button
                        type="button"
                        title="Void"
                        onClick={() => void action(je.id, 'void')}
                        className="p-1.5 rounded-lg border border-neutral-200 hover:border-red-200 text-neutral-500 hover:text-red-600"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {(je.lines || []).length > 0 && (
                  <div className="mt-2 rounded-2xl border border-neutral-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-400 uppercase tracking-wider">
                          <th className="px-3 py-2 text-left font-semibold">Account</th>
                          <th className="px-3 py-2 text-right font-semibold">Debit</th>
                          <th className="px-3 py-2 text-right font-semibold">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(je.lines || []).map((l, i) => (
                          <tr key={l.id || i} className="border-t border-neutral-50">
                            <td className="px-3 py-1.5 text-slate-700">
                              {accountName(Number(l.account_id))}
                              {l.memo ? (
                                <span className="text-neutral-400"> — {l.memo}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {Number(l.debit) > 0 ? formatMoney(l.debit) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {Number(l.credit) > 0 ? formatMoney(l.credit) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-slate-900">
                  {editMode.type === 'edit_draft'
                    ? `Edit draft ${editMode.label || ''}`
                    : editMode.type === 'edit_posted'
                      ? `Edit / reclassify ${editMode.label || ''}`
                      : 'New journal entry'}
                </h3>
                {editMode.type === 'edit_posted' && (
                  <p className="text-[11px] text-amber-800 mt-0.5 max-w-lg">
                    Change any line&apos;s COA account (or amounts). We reverse the original posted
                    entry and post these lines as the replacement so reports and audit stay
                    correct.
                  </p>
                )}
                {editMode.type === 'edit_draft' && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Update accounts, debits/credits, date and memo. Save as draft or post when
                    balanced.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveJournal} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Date
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Memo
                  <input
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Description"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-neutral-600">
                    Lines — pick the COA account for each debit/credit
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      placeholder="Filter accounts by code or name…"
                      className="rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs w-56 sm:w-64"
                    />
                  </div>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                  <div className="col-span-5">Account (COA)</div>
                  <div className="col-span-2 text-right">Debit</div>
                  <div className="col-span-2 text-right">Credit</div>
                  <div className="col-span-2">Line memo</div>
                  <div className="col-span-1" />
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-5">
                      <select
                        value={line.account_id}
                        onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs bg-white"
                        required={idx < 2}
                      >
                        <option value="">Select account…</option>
                        {/* Keep selected account visible even if filter hides it */}
                        {line.account_id &&
                          !filteredAccounts.some(
                            (a) => String(a.id) === String(line.account_id)
                          ) &&
                          (() => {
                            const cur = accounts.find(
                              (a) => String(a.id) === String(line.account_id)
                            );
                            return cur ? (
                              <option key={`cur-${cur.id}`} value={cur.id}>
                                {cur.code} · {cur.name}
                                {cur.account_type ? ` (${cur.account_type})` : ''}
                              </option>
                            ) : (
                              <option value={line.account_id}>
                                Account #{line.account_id}
                              </option>
                            );
                          })()}
                        {filteredAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                            {a.account_type ? ` (${a.account_type})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit"
                        value={line.debit}
                        onChange={(e) =>
                          updateLine(idx, {
                            debit: e.target.value,
                            credit: e.target.value ? '' : line.credit,
                          })
                        }
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs text-right"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit"
                        value={line.credit}
                        onChange={(e) =>
                          updateLine(idx, {
                            credit: e.target.value,
                            debit: e.target.value ? '' : line.debit,
                          })
                        }
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs text-right"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        placeholder="Memo"
                        value={line.memo}
                        onChange={(e) => updateLine(idx, { memo: e.target.value })}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="p-2 text-neutral-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setLines([...lines, emptyLine()])}
                  className="text-xs font-semibold text-[#00b4d8] hover:underline"
                >
                  + Add line
                </button>
                {accountFilter && filteredAccounts.length === 0 && (
                  <p className="text-[11px] text-amber-700">
                    No COA accounts match “{accountFilter}”. Clear the filter or add the account
                    under Chart of accounts.
                  </p>
                )}
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm flex flex-wrap justify-between gap-2 ${
                  balance.ok
                    ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                    : 'border-amber-100 bg-amber-50/50 text-amber-950'
                }`}
              >
                <span>Debits {formatMoney(balance.debit)}</span>
                <span>Credits {formatMoney(balance.credit)}</span>
                <span className="font-bold">
                  {balance.ok ? 'Balanced' : 'Out of balance'}
                </span>
              </div>

              {editMode.type !== 'edit_posted' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <input
                    type="checkbox"
                    checked={postNow}
                    onChange={(e) => setPostNow(e.target.checked)}
                  />
                  {editMode.type === 'edit_draft'
                    ? 'Post after save (must balance)'
                    : 'Post to the company ledger (must balance)'}
                </label>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-4 text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !py-2 !px-4 text-sm"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editMode.type === 'edit_posted' ? (
                    'Save reclassification'
                  ) : editMode.type === 'edit_draft' ? (
                    postNow ? 'Save & post' : 'Save draft'
                  ) : postNow ? (
                    'Post entry'
                  ) : (
                    'Save draft'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
