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
  RotateCcw,
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

const emptyLine = (): LineForm => ({ account_id: '', debit: '', credit: '', memo: '' });

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
  /** null = create · draft id = edit draft · posted id = correct (reverse + new) */
  const [editMode, setEditMode] = useState<{
    type: 'create' | 'edit_draft' | 'correct';
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
          `/api/accounting/chart-of-accounts?companyId=${companyId}${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`
        ),
      ]);
      const jeData = await jeRes.json();
      const coaData = await coaRes.json();
      setEntries(jeData.entries || []);
      setAccounts((coaData.accounts || []).filter((a: CoaAccount) => !a.is_header && a.is_active !== false));
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

  function openCreate() {
    setEditMode({ type: 'create' });
    setMemo('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPostNow(true);
    setLines([emptyLine(), emptyLine()]);
    setShowModal(true);
  }

  function openEditDraft(je: JournalEntry) {
    setEditMode({
      type: 'edit_draft',
      id: je.id,
      label: je.entry_number || `JE-${je.id}`,
    });
    setMemo(je.memo || '');
    setEntryDate(String(je.entry_date || '').slice(0, 10));
    setPostNow(false);
    const formLines = (je.lines || []).map((l) => ({
      account_id: String(l.account_id || ''),
      debit: Number(l.debit) > 0 ? String(l.debit) : '',
      credit: Number(l.credit) > 0 ? String(l.credit) : '',
      memo: l.memo || '',
    }));
    setLines(formLines.length >= 2 ? formLines : [emptyLine(), emptyLine()]);
    setShowModal(true);
  }

  function openCorrect(je: JournalEntry) {
    setEditMode({
      type: 'correct',
      id: je.id,
      label: je.entry_number || `JE-${je.id}`,
    });
    setMemo(`Correction of ${je.entry_number || je.id}${je.memo ? `: ${je.memo}` : ''}`);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPostNow(true);
    const formLines = (je.lines || []).map((l) => ({
      account_id: String(l.account_id || ''),
      debit: Number(l.debit) > 0 ? String(l.debit) : '',
      credit: Number(l.credit) > 0 ? String(l.credit) : '',
      memo: l.memo || '',
    }));
    setLines(formLines.length >= 2 ? formLines : [emptyLine(), emptyLine()]);
    setShowModal(true);
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
    if ((postNow || editMode.type === 'correct') && !balance.ok) {
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
          toast.success('Draft updated');
        }
      } else if (editMode.type === 'correct' && editMode.id) {
        const res = await fetch('/api/accounting/journals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            id: editMode.id,
            action: 'correct',
            entry_date: entryDate,
            memo,
            lines: payloadLines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        toast.success(
          `Corrected — original reversed, new entry ${data.entry?.entry_number || ''} posted`
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
        'Reverse this posted journal? A reversing entry will be posted and the original voided — use this to undo allocation/VAT mistakes, then post the correct journal.',
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
        act === 'post' ? 'Posted' : act === 'void' ? 'Voided' : 'Reversed — correcting entry created'
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const accountName = (id: number) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name}` : `#${id}`;
  };

  return (
    <AccountingPage>
      <AccountingHeader
        title="Journal"
        titleAccent="entries"
        description="Create, edit drafts, reverse posted mistakes, or correct entries (reverse + re-post). Bank misallocations: unallocate on Bank first, then re-allocate with the right VAT/GL."
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
        <strong className="text-slate-800">Fixing errors · </strong>
        <strong>Draft</strong> → Edit &amp; save / post. <strong>Posted</strong> → Reverse (undo)
        or Correct (reverse + enter right lines). <strong>Bank/VAT</strong> → Bank recon →
        Unallocate → re-classify VAT on Tax page → allocate again.
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
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {je.entry_date}
                      {je.memo ? ` · ${je.memo}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="tabular-nums font-semibold text-slate-800">
                        D {formatMoney(je.total_debit)}
                      </div>
                      <div className="tabular-nums text-neutral-500">
                        C {formatMoney(je.total_credit)}
                      </div>
                    </div>
                    {je.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          title="Edit draft"
                          onClick={() => openEditDraft(je)}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] text-neutral-500 hover:text-[#0077b6]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Post"
                          onClick={() => void action(je.id, 'post')}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-emerald-300 text-neutral-500 hover:text-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {je.status === 'posted' && (
                      <>
                        <button
                          type="button"
                          title="Reverse (undo posted entry)"
                          onClick={() => void action(je.id, 'reverse')}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-amber-300 text-neutral-500 hover:text-amber-700"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Correct (reverse + re-enter lines)"
                          onClick={() => openCorrect(je)}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] text-neutral-500 hover:text-[#0077b6]"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </>
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
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <div>
                <h3 className="font-bold">
                  {editMode.type === 'edit_draft'
                    ? `Edit draft ${editMode.label || ''}`
                    : editMode.type === 'correct'
                      ? `Correct ${editMode.label || ''}`
                      : 'New journal entry'}
                </h3>
                {editMode.type === 'correct' && (
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Saves a reversing entry of the original, then posts your corrected lines.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
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
                <div className="text-xs font-semibold text-neutral-600">Lines</div>
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <select
                        value={line.account_id}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, account_id: e.target.value };
                          setLines(next);
                        }}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs bg-white"
                        required={idx < 2}
                      >
                        <option value="">Account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit"
                        value={line.debit}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, debit: e.target.value, credit: e.target.value ? '' : line.credit };
                          setLines(next);
                        }}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit"
                        value={line.credit}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, credit: e.target.value, debit: e.target.value ? '' : line.debit };
                          setLines(next);
                        }}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        placeholder="Memo"
                        value={line.memo}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, memo: e.target.value };
                          setLines(next);
                        }}
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
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm flex justify-between ${
                  balance.ok
                    ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                    : 'border-amber-100 bg-amber-50/50 text-amber-950'
                }`}
              >
                <span>Debits {formatMoney(balance.debit)}</span>
                <span>Credits {formatMoney(balance.credit)}</span>
                <span className="font-bold">{balance.ok ? 'Balanced' : 'Out of balance'}</span>
              </div>

              {editMode.type !== 'correct' && (
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
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editMode.type === 'correct' ? (
                    'Post correction'
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
