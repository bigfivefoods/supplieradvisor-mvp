'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/inventory/types';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';
import {
  actorLabel,
  groupLinesByFamily,
} from '@/lib/commercial/engine';
import type {
  PartyCatalogueLine,
  PartyKind,
  PriceActor,
  PriceRevision,
} from '@/lib/commercial/types';
import { PortalCataloguePicker } from '@/components/commercial/PortalCataloguePicker';

export function CommercialPanel({
  partyKind,
  actor,
  hostName,
  partyName,
  lines,
  busy,
  companyId,
  supplierId,
  customerId,
  onAct,
  onHostAction,
  canAdd,
}: {
  partyKind: PartyKind;
  actor: PriceActor;
  hostName: string;
  partyName: string;
  lines: PartyCatalogueLine[];
  busy?: boolean;
  companyId?: number;
  supplierId?: number | null;
  customerId?: number | null;
  onAct?: (payload: Record<string, unknown>) => Promise<unknown>;
  onHostAction?: () => void;
  canAdd?: boolean;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, PriceRevision[]>>({});
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const [sla, setSla] = useState<
    Record<
      number,
      {
        short_description: string;
        long_description: string;
        lead_time_days: string;
        moq: string;
      }
    >
  >({});
  const [addOpen, setAddOpen] = useState(false);
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const groups = useMemo(() => groupLinesByFamily(lines), [lines]);
  const buy = partyKind === 'supplier';

  const loadHistory = async (lineId: number) => {
    if (history[lineId]) {
      setOpenId((cur) => (cur === lineId ? null : lineId));
      return;
    }
    if (onAct) {
      const data = (await onAct({
        action: 'commercial_history',
        line_id: lineId,
      })) as { revisions?: PriceRevision[] } | undefined;
      setHistory((prev) => ({ ...prev, [lineId]: data?.revisions || [] }));
      setOpenId(lineId);
      return;
    }
    if (!companyId) return;
    const params = new URLSearchParams({
      companyId: String(companyId),
      partyKind,
      lineId: String(lineId),
    });
    if (supplierId) params.set('supplierId', String(supplierId));
    if (customerId) params.set('customerId', String(customerId));
    const res = await fetch(`/api/commercial/lines?${params}`);
    const data = await res.json();
    setHistory((prev) => ({ ...prev, [lineId]: data.revisions || [] }));
    setOpenId(lineId);
  };

  const runHost = async (body: Record<string, unknown>) => {
    if (onAct) {
      await onAct(body);
      return;
    }
    const res = await fetch('/api/commercial/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        companyId,
        partyKind,
        supplierId,
        customerId,
        ...body,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    onHostAction?.();
  };

  const propose = async (line: PartyCatalogueLine) => {
    const price = Number(draft[line.id]);
    try {
      await runHost({
        action: onAct ? 'commercial_propose' : 'propose',
        lineId: line.id,
        line_id: line.id,
        price,
        note: note[line.id] || null,
      });
      setDraft((d) => ({ ...d, [line.id]: '' }));
    } catch {
      /* onAct surfaces the note */
    }
  };

  const decide = async (line: PartyCatalogueLine, action: 'accept' | 'reject') => {
    try {
      await runHost({
        action: onAct ? `commercial_${action}` : action,
        lineId: line.id,
        line_id: line.id,
        note: note[line.id] || null,
      });
    } catch {
      /* onAct surfaces the note */
    }
  };

  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    const res = await fetch(`/api/inventory/products?companyId=${companyId}`);
    const data = await res.json();
    setProducts(
      ((data.products || []) as Array<{ id: number; name: string }>).map((p) => ({
        id: Number(p.id),
        name: String(p.name || `SKU ${p.id}`),
      }))
    );
  }, [companyId]);

  useEffect(() => {
    if (addOpen) void loadProducts();
  }, [addOpen, loadProducts]);

  if (!lines.length && !canAdd) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        No SKUs shared with this portal yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
          Commercial
        </p>
        <h2 className="text-sm font-black text-slate-900">
          {buy
            ? `What we pay ${partyName}`
            : `What ${partyName} pays ${hostName}`}
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Accepted price is billed. A new figure stays pending until the other
          side Accepts.
        </p>
      </div>

      {canAdd ? (
        <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4">
          <button
            type="button"
            className="btn-secondary !py-2 !px-3 text-xs"
            onClick={() => setAddOpen((v) => !v)}
          >
            Add from inventory
          </button>
          {addOpen ? (
            <div className="mt-3 space-y-2">
              <div className="max-h-48 overflow-auto rounded-2xl border border-slate-100">
                {products.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-50 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((cur) =>
                            on ? cur.filter((id) => id !== p.id) : [...cur, p.id]
                          )
                        }
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy || !picked.length}
                className="btn-primary !py-2 !px-3 text-xs min-h-[44px]"
                onClick={() =>
                  void runHost({
                    action: onAct ? 'commercial_add' : 'add',
                    productIds: picked,
                  }).then(() => {
                    setPicked([]);
                    setAddOpen(false);
                  })
                }
              >
                Add {picked.length || ''} SKU{picked.length === 1 ? '' : 's'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.map((g) => (
        <section
          key={g.family}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {g.family}
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.lines.map((line) => {
              const pending = line.pending_price != null;
              const canDecide =
                pending && actor !== line.pending_proposed_by;
              const who = actorLabel({
                actor: line.pending_proposed_by,
                hostName,
                partyName,
              });
              return (
                <li key={line.id} className="px-4 py-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {line.primary_image_url ? (
                        <button
                          type="button"
                          className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 overflow-hidden bg-[#f8f7f5]"
                          onClick={() =>
                            window.open(String(line.primary_image_url), '_blank')
                          }
                        >
                          <ProductPhoto
                            src={line.primary_image_url}
                            alt={line.product_name || ''}
                            className="h-14 w-14"
                          />
                        </button>
                      ) : (
                        <span className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" />
                      )}
                      <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {line.product_name}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {[
                          line.sku,
                          line.product_type?.replace(/_/g, ' '),
                          line.uom,
                          line.lead_time_days != null
                            ? `${line.lead_time_days}d lead`
                            : null,
                          line.moq != null ? `MOQ ${line.moq}` : null,
                          line.qty_on_hand != null
                            ? `${line.qty_on_hand} at site`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {line.short_description ? (
                        <p className="text-xs text-neutral-600 mt-1">
                          {line.short_description}
                        </p>
                      ) : null}
                      </div>
                    </div>
                    <p className="text-xl font-black tabular-nums text-slate-900">
                      {formatMoney(line.accepted_price, line.currency)}
                    </p>
                  </div>
                  {pending ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Proposed {formatMoney(line.accepted_price, line.currency)} →{' '}
                      {formatMoney(Number(line.pending_price), line.currency)} by{' '}
                      {who}
                      {line.pending_proposed_at
                        ? ` · ${new Date(line.pending_proposed_at).toLocaleDateString()}`
                        : ''}
                      {canDecide ? (
                        <span className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="btn-primary !py-1.5 !px-3 text-xs min-h-[44px]"
                            onClick={() => void decide(line, 'accept')}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="btn-secondary !py-1.5 !px-3 text-xs min-h-[44px]"
                            onClick={() => void decide(line, 'reject')}
                          >
                            Reject
                          </button>
                        </span>
                      ) : (
                        <p className="mt-1 text-[11px] text-amber-800">
                          Waiting for {actor === 'host' ? partyName : hostName} to
                          Accept or Reject.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="input !py-1.5 !px-2 !text-xs w-28"
                      placeholder="New price"
                      value={draft[line.id] || ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [line.id]: e.target.value }))
                      }
                    />
                    <input
                      className="input !py-1.5 !px-2 !text-xs flex-1 min-w-[8rem]"
                      placeholder="Note (optional)"
                      value={note[line.id] || ''}
                      onChange={(e) =>
                        setNote((d) => ({ ...d, [line.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busy || !draft[line.id]}
                      className="btn-secondary !py-1.5 !px-3 text-xs min-h-[44px]"
                      onClick={() => void propose(line)}
                    >
                      Propose
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-[#0077b6]"
                      onClick={() => void loadHistory(line.id)}
                    >
                      {openId === line.id ? 'Hide history' : 'History'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      className="input !py-1.5 !px-2 !text-xs"
                      placeholder="Lead time (days)"
                      value={
                        sla[line.id]?.lead_time_days ??
                        (line.lead_time_days != null
                          ? String(line.lead_time_days)
                          : '')
                      }
                      onChange={(e) =>
                        setSla((s) => ({
                          ...s,
                          [line.id]: {
                            short_description:
                              s[line.id]?.short_description ??
                              line.short_description ??
                              '',
                            long_description:
                              s[line.id]?.long_description ??
                              line.long_description ??
                              '',
                            lead_time_days: e.target.value,
                            moq: s[line.id]?.moq ?? (line.moq != null ? String(line.moq) : ''),
                          },
                        }))
                      }
                    />
                    <input
                      className="input !py-1.5 !px-2 !text-xs"
                      placeholder="MOQ"
                      value={
                        sla[line.id]?.moq ??
                        (line.moq != null ? String(line.moq) : '')
                      }
                      onChange={(e) =>
                        setSla((s) => ({
                          ...s,
                          [line.id]: {
                            short_description:
                              s[line.id]?.short_description ??
                              line.short_description ??
                              '',
                            long_description:
                              s[line.id]?.long_description ??
                              line.long_description ??
                              '',
                            lead_time_days:
                              s[line.id]?.lead_time_days ??
                              (line.lead_time_days != null
                                ? String(line.lead_time_days)
                                : ''),
                            moq: e.target.value,
                          },
                        }))
                      }
                    />
                    {actor === 'host' ? (
                      <textarea
                        className="input !py-1.5 !px-2 !text-xs sm:col-span-2 min-h-[52px]"
                        placeholder="Short description"
                        value={
                          sla[line.id]?.short_description ??
                          line.short_description ??
                          ''
                        }
                        onChange={(e) =>
                          setSla((s) => ({
                            ...s,
                            [line.id]: {
                              short_description: e.target.value,
                              long_description:
                                s[line.id]?.long_description ??
                                line.long_description ??
                                '',
                              lead_time_days:
                                s[line.id]?.lead_time_days ??
                                (line.lead_time_days != null
                                  ? String(line.lead_time_days)
                                  : ''),
                              moq:
                                s[line.id]?.moq ??
                                (line.moq != null ? String(line.moq) : ''),
                            },
                          }))
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      className="btn-secondary !py-1.5 !px-3 text-xs min-h-[44px] sm:col-span-2"
                      onClick={() =>
                        void runHost({
                          action: onAct ? 'commercial_sla' : 'sla',
                          lineId: line.id,
                          line_id: line.id,
                          product_id: line.product_id,
                          short_description:
                            sla[line.id]?.short_description ??
                            line.short_description,
                          long_description:
                            sla[line.id]?.long_description ??
                            line.long_description,
                          lead_time_days: Number(
                            sla[line.id]?.lead_time_days ?? line.lead_time_days
                          ),
                          moq: Number(sla[line.id]?.moq ?? line.moq),
                        })
                      }
                    >
                      Save lead / MOQ{actor === 'host' ? ' / description' : ''}
                    </button>
                  </div>
                  {openId === line.id ? (
                    <ol className="text-xs text-neutral-600 space-y-1 pl-1">
                      {(history[line.id] || []).map((r) => (
                        <li key={r.id}>
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : ''}{' '}
                          · {r.proposed_by === 'host' ? hostName : partyName} ·{' '}
                          {r.old_price != null
                            ? `${formatMoney(r.old_price, r.currency)} → `
                            : 'seed '}
                          {formatMoney(r.new_price, r.currency)} · {r.status}
                          {r.note ? ` · ${r.note}` : ''}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ProductCommercial({
  companyId,
  productId,
  productName,
}: {
  companyId: number;
  productId: number;
  productName: string;
}) {
  const [lines, setLines] = useState<PartyCatalogueLine[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({
        companyId: String(companyId),
        both: '1',
        productId: String(productId),
      });
      const res = await fetch(`/api/commercial/lines?${params}`);
      const data = await res.json();
      if (!cancelled) setLines(data.lines || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, productId]);
  if (!lines.length) return null;
  return (
    <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
        Sold to / bought from
      </p>
      <ul className="text-xs space-y-1">
        {lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-2">
            <span>
              {l.party_kind === 'supplier' ? 'Buy' : 'Sell'} · {productName}
            </span>
            <span className="font-black tabular-nums">
              {formatMoney(l.accepted_price, l.currency)}
              {l.pending_price != null
                ? ` → pending ${formatMoney(l.pending_price, l.currency)}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HostCommercial({
  companyId,
  partyKind,
  supplierId,
  customerId,
  partyName,
  hostName = 'Big Five Foods',
}: {
  companyId: number;
  partyKind: PartyKind;
  supplierId?: number | null;
  customerId?: number | null;
  partyName: string;
  hostName?: string;
}) {
  const [lines, setLines] = useState<PartyCatalogueLine[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      partyKind,
    });
    if (supplierId) params.set('supplierId', String(supplierId));
    if (customerId) params.set('customerId', String(customerId));
    const res = await fetch(`/api/commercial/lines?${params}`);
    const data = await res.json();
    setLines(data.lines || []);
  }, [companyId, partyKind, supplierId, customerId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-4">
      {partyKind === 'supplier' && supplierId ? (
        <PortalCataloguePicker
          companyId={companyId}
          supplierId={supplierId}
          tickedIds={lines.map((l) => l.product_id)}
          onChanged={() => {
            setBusy(true);
            void load().finally(() => setBusy(false));
          }}
        />
      ) : null}
      <CommercialPanel
        partyKind={partyKind}
        actor="host"
        hostName={hostName}
        partyName={partyName}
        lines={lines}
        busy={busy}
        companyId={companyId}
        supplierId={supplierId}
        customerId={customerId}
        canAdd={partyKind === 'customer'}
        onHostAction={() => {
          setBusy(true);
          void load().finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
