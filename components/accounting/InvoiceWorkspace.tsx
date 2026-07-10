'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Search,
  Send,
  CheckCircle2,
  Ban,
  CreditCard,
  X,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  statusClass,
  type AccountingInvoice,
  type InvoiceDirection,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type Props = {
  direction: InvoiceDirection;
  title: string;
  titleAccent?: string;
  description: string;
};

const emptyForm = {
  counterparty_name: '',
  counterparty_profile_id: '' as string,
  invoice_number: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  currency: 'ZAR',
  tax_rate: '15',
  description: '',
  quantity: '1',
  unit_price: '',
  notes: '',
  status: 'draft',
};

type NetworkPeer = {
  id: number;
  trading_name: string;
  role?: string;
};

export default function InvoiceWorkspace({
  direction,
  title,
  titleAccent,
  description,
}: Props) {
  return (
    <CompanyRequired>
      <Inner direction={direction} title={title} titleAccent={titleAccent} description={description} />
    </CompanyRequired>
  );
}

function Inner({ direction, title, titleAccent, description }: Props) {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showPay, setShowPay] = useState<AccountingInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('eft');
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [peers, setPeers] = useState<NetworkPeer[]>([]);

  const noun = direction === 'receivable' ? 'invoice' : 'bill';
  const counterpartyLabel = direction === 'receivable' ? 'Customer' : 'Supplier';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        direction,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (q) params.set('q', q);
      const res = await fetch(`/api/accounting/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, direction, privyUserId, statusFilter, q]);

  const loadPeers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/connections?${params}`);
      const data = await res.json();
      const edges = (data.edges || []) as Array<{
        status: string;
        suspended?: boolean;
        role?: string;
        peer?: { id?: number; trading_name?: string | null; legal_name?: string | null };
      }>;
      const list: NetworkPeer[] = [];
      const seen = new Set<number>();
      for (const e of edges) {
        if (e.status !== 'accepted' || e.suspended) continue;
        const id = Number(e.peer?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push({
          id,
          trading_name:
            e.peer?.trading_name || e.peer?.legal_name || `Company #${id}`,
          role: e.role,
        });
      }
      list.sort((a, b) => a.trading_name.localeCompare(b.trading_name));
      setPeers(list);
    } catch {
      setPeers([]);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (showModal) void loadPeers();
  }, [showModal, loadPeers]);

  const totals = useMemo(() => {
    const open = invoices.filter(
      (i) => !['paid', 'void', 'cancelled'].includes(String(i.status)) && (i.balance_due || 0) > 0
    );
    const overdue = open.filter((i) => i.status === 'overdue');
    return {
      count: invoices.length,
      open: open.length,
      openAmount: open.reduce((s, i) => s + Number(i.balance_due || 0), 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.balance_due || 0), 0),
    };
  }, [invoices]);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!form.counterparty_name.trim()) {
      toast.error(`${counterpartyLabel} name required`);
      return;
    }
    setSaving(true);
    try {
      const unit = Number(form.unit_price || 0);
      const qty = Number(form.quantity || 1);
      const items =
        unit > 0
          ? [
              {
                description: form.description || `${noun} line`,
                quantity: qty,
                unit_price: unit,
                tax_rate: Number(form.tax_rate || 15),
              },
            ]
          : [];
      const counterpartyProfileId = form.counterparty_profile_id
        ? Number(form.counterparty_profile_id)
        : null;
      const res = await fetch('/api/accounting/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          direction,
          counterparty_name: form.counterparty_name,
          counterparty_profile_id: counterpartyProfileId || undefined,
          invoice_number: form.invoice_number || undefined,
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          currency: form.currency,
          tax_rate: Number(form.tax_rate || 15),
          status: form.status,
          notes: form.notes || null,
          items,
          total_amount: unit > 0 ? undefined : Number(form.unit_price || 0),
          subtotal: unit > 0 ? undefined : Number(form.unit_price || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.mirroredInvoiceId
          ? `${noun[0].toUpperCase()}${noun.slice(1)} created and mirrored to connected company`
          : `${noun[0].toUpperCase()}${noun.slice(1)} created`
      );
      setShowModal(false);
      setForm(emptyForm);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(inv: AccountingInvoice, status: string) {
    try {
      const res = await fetch('/api/accounting/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id: inv.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Marked ${status}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!showPay) return;
    const amount = Number(payAmount);
    if (!(amount > 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          invoice_id: showPay.id,
          amount,
          method: payMethod,
          reference: payRef || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Payment recorded');
      setShowPay(null);
      setPayAmount('');
      setPayRef('');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title={title}
        titleAccent={titleAccent}
        description={description}
        action={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            <Plus className="w-4 h-4" /> New {noun}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Total" value={totals.count} />
        <MiniKpi label="Open" value={totals.open} sub={formatMoney(totals.openAmount)} />
        <MiniKpi
          label="Overdue"
          value={totals.overdue}
          sub={formatMoney(totals.overdueAmount)}
          tone={totals.overdue > 0 ? 'amber' : 'neutral'}
        />
        <MiniKpi
          label="Collected / paid"
          value={formatMoney(
            invoices
              .filter((i) => i.status === 'paid')
              .reduce((s, i) => s + Number(i.total_amount || 0), 0)
          )}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${noun}s…`}
            className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-neutral-200 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No {noun}s yet. Create one to start tracking{' '}
            {direction === 'receivable' ? 'collections' : 'supplier bills'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Number</th>
                  <th className="px-4 py-3 font-semibold">{counterpartyLabel}</th>
                  <th className="px-4 py-3 font-semibold">Issue</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {inv.invoice_number || `—${inv.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {inv.counterparty_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 tabular-nums">
                      {inv.issue_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 tabular-nums">
                      {inv.due_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatMoney(inv.total_amount, inv.currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatMoney(inv.balance_due, inv.currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(inv.status))}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {inv.status === 'draft' && (
                          <IconBtn
                            title="Mark sent"
                            onClick={() => setStatus(inv, 'sent')}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </IconBtn>
                        )}
                        {!['paid', 'void', 'cancelled'].includes(String(inv.status)) &&
                          Number(inv.balance_due || 0) > 0 && (
                            <IconBtn
                              title="Record payment"
                              onClick={() => {
                                setShowPay(inv);
                                setPayAmount(String(inv.balance_due || inv.total_amount || ''));
                              }}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </IconBtn>
                          )}
                        {!['paid', 'void'].includes(String(inv.status)) && (
                          <IconBtn
                            title="Mark paid in full"
                            onClick={() =>
                              setStatus(inv, 'paid')
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </IconBtn>
                        )}
                        {!['void', 'paid'].includes(String(inv.status)) && (
                          <IconBtn title="Void" onClick={() => setStatus(inv, 'void')}>
                            <Ban className="w-3.5 h-3.5" />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showModal && (
        <Modal title={`New ${noun}`} onClose={() => setShowModal(false)}>
          <form onSubmit={createInvoice} className="space-y-4">
            {peers.length > 0 && (
              <Field label={`Network ${counterpartyLabel.toLowerCase()}`}>
                <select
                  className="field"
                  value={form.counterparty_profile_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const peer = peers.find((p) => String(p.id) === id);
                    setForm({
                      ...form,
                      counterparty_profile_id: id,
                      counterparty_name: peer?.trading_name || form.counterparty_name,
                    });
                  }}
                >
                  <option value="">Manual entry / free text…</option>
                  {peers.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.trading_name}
                      {p.role ? ` (${p.role})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Connected companies sync this {noun} to their books automatically.
                </p>
              </Field>
            )}
            <Field label={counterpartyLabel} required>
              <input
                required
                value={form.counterparty_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    counterparty_name: e.target.value,
                    // free-text edit clears network link unless name still matches
                    counterparty_profile_id:
                      peers.some(
                        (p) =>
                          String(p.id) === form.counterparty_profile_id &&
                          p.trading_name === e.target.value
                      )
                        ? form.counterparty_profile_id
                        : '',
                  })
                }
                className="field"
                placeholder={direction === 'receivable' ? 'Customer name' : 'Supplier name'}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date">
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  className="field"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="field"
                />
              </Field>
            </div>
            <Field label="Line description">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="field"
                placeholder="Goods / services"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Qty">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="field"
                />
              </Field>
              <Field label="Unit price" required>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  className="field"
                />
              </Field>
              <Field label="Tax %">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                  className="field"
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="field min-h-[72px]"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPay && (
        <Modal
          title={`Payment — ${showPay.invoice_number || showPay.id}`}
          onClose={() => setShowPay(null)}
        >
          <form onSubmit={recordPayment} className="space-y-4">
            <p className="text-sm text-neutral-600">
              {showPay.counterparty_name} · Balance{' '}
              <strong>{formatMoney(showPay.balance_due, showPay.currency || 'ZAR')}</strong>
            </p>
            <Field label="Amount" required>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="field"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="field"
                >
                  <option value="eft">EFT</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="yoco">YOCO</option>
                  <option value="stripe">Stripe</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Reference">
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="field"
                  placeholder="Bank ref"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowPay(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e5e5;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
        .field:focus {
          outline: none;
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.12);
        }
      `}</style>
    </AccountingPage>
  );
}

function MiniKpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'neutral' | 'amber';
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        tone === 'amber' ? 'border-amber-100 bg-amber-50/50' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-xl font-black tracking-tighter text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] hover:text-[#0077b6] text-neutral-500 transition-colors"
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600 mb-1 block">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
