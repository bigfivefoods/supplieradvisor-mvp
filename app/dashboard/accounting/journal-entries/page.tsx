'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memo, setMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [postNow, setPostNow] = useState(true);
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()]);
  const [accountFilter, setAccountFilter] = useState('');
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
      const [jeRes, coaRes] = await Promise.all([
        fetch(`/api/accounting/journals?${params}`),
        fetch(
          `/api/accounting/chart-of-accounts?companyId=${companyId}${
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
  }, [companyId, privyUserId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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

  function openCreate() {
    setEditMode({ type: 'create' });
    setMemo('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPostNow(true);
    setLines([emptyLine(), emptyLine()]);
    setAccountFilter('');
    setShowModal(true);
  }

  /** Edit draft in place, or reclassify a posted entry (change COA / amounts). */
  function openEdit(je: JournalEntry) {
    const label = je.entry_number || `JE-${je.id}`;
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
          `Reclassified — original reversed, new entry ${data.entry?.entry_number || ''} posted`
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function action(id: number, act: 'post' | 'void' | 'reverse') {
    const labels = {
      post: 'Post this draft?',
      void: 'Void this journal? It will no longer affect reports.',
      reverse:
        'Reverse this posted journal? A reversing entry will be posted and the original voided. Use Edit instead if you want to reclassify to different COA accounts.',
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
            : 'Reversed — original voided'
      );
      void load();
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
        description="Create journals, edit drafts, or reclassify posted entries to different chart-of-accounts codes. Posted edits reverse the original and post a corrected entry so the audit trail stays intact."
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

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Edit / reclassify · </strong>
        <strong>Draft</strong> → Edit (change COA accounts, amounts, memo) then save or post.{' '}
        <strong>Posted</strong> → Edit to push lines to a new COA account (system reverses the
        original and posts your corrected journal). <strong>Reverse</strong> undoes without a
        replacement. <strong>Bank/VAT</strong> → Bank recon → Unallocate → re-allocate if the
        source bank line is wrong.
      </div>

      <div className="mb-4">
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
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No journal entries yet. Seed a chart of accounts first, then post your first entry.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {entries.map((je) => (
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
                    {(je.status === 'draft' || je.status === 'posted') && (
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
                    {je.status === 'posted' && (
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
                    {je.status !== 'void' && (
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
                    : 'Post immediately (must balance)'}
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
