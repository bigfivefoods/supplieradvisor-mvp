'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, QrCode, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import {
  evaluateMemberAccess,
  gymCheckinUrl,
} from '@/lib/fitness/fitgraph';

export default function CheckinsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    client_id: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString().slice(11, 16),
    method: 'front_desk',
    session_id: '',
  });

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const checkinUrl = store?.settings?.public_token
    ? gymCheckinUrl(origin || 'https://app', store.settings.public_token)
    : '';
  const qrImg = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(checkinUrl)}`
    : '';

  const today = new Date().toISOString().slice(0, 10);
  const unpaidToday = useMemo(() => {
    if (!store) return [];
    return store.check_ins.filter(
      (c) =>
        c.date === today &&
        (c.payment_ok === false || Boolean(c.access_alert))
    );
  }, [store, today]);

  const add = async () => {
    if (!form.client_id) {
      toast.error('Select client');
      return;
    }
    const client = store?.clients.find((c) => c.id === form.client_id);
    const access = client && store ? evaluateMemberAccess(store, client) : null;
    await post({
      entity: 'check_ins',
      action: 'upsert',
      record: {
        ...form,
        session_id: form.session_id || null,
        membership_status: access?.membership_status || client?.membership_status,
        subscription_status: access?.subscription_status || null,
        payment_ok: access?.payment_ok ?? true,
        access_alert: access?.alert || null,
        access_level: access?.level || 'allowed',
        notes: access?.alert || undefined,
      },
    });
    if (access && !access.payment_ok) {
      toast.warning(access.alert || 'Member payment issue — check-in logged');
    } else {
      toast.success('Check-in recorded');
    }
  };

  return (
    <FitgraphWorkbench
      title="Check-ins"
      titleAccent="door · desk · phone"
      description="Front-desk log plus phone QR check-ins. Unpaid or frozen memberships are flagged so you can action them on the floor."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          {checkinUrl ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-950/40">
              {qrImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImg}
                  alt="Check-in QR"
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-lg bg-white p-1"
                />
              ) : (
                <QrCode className="h-10 w-10 text-violet-700" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-violet-950 dark:text-violet-50">
                  Unique gym QR — members scan to check in on their phones
                </p>
                <p className="truncate font-mono text-[11px] text-violet-800/80 dark:text-violet-200/80">
                  {checkinUrl}
                </p>
              </div>
              <Link
                href="/dashboard/fitgraph/website"
                className="shrink-0 rounded-full bg-violet-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Full QR & print
              </Link>
            </div>
          ) : null}

          <StatRow
            tone="owner"
            items={[
              {
                label: 'Today',
                value: Number(summary?.checkInsToday) || 0,
              },
              {
                label: 'Unpaid / alert today',
                value:
                  Number(summary?.checkInsUnpaidToday) || unpaidToday.length,
              },
              {
                label: 'Blocked today',
                value: Number(summary?.checkInsBlockedToday) || 0,
              },
              {
                label: 'All time',
                value: Number(summary?.checkInsTotal) || store.check_ins.length,
              },
            ]}
          />

          {unpaidToday.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
              <p className="flex items-center gap-2 text-sm font-black text-amber-950 dark:text-amber-50">
                <ShieldAlert className="h-4 w-4" />
                Payment / access alerts today ({unpaidToday.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {unpaidToday.slice(0, 12).map((c) => {
                  const client = store.clients.find((x) => x.id === c.client_id);
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-50"
                    >
                      <span className="font-bold">
                        {client?.name || c.client_id}
                        <span className="ml-1 font-normal opacity-80">
                          · {c.time || '—'} · {c.method || '—'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2 py-0.5 font-semibold dark:bg-amber-900/60">
                        <AlertTriangle className="h-3 w-3" />
                        {c.access_alert ||
                          c.subscription_status ||
                          c.membership_status ||
                          'Alert'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <FormCard
            tone="owner"
            title="Check in member (desk)"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Check in"
          >
            <select
              className={fc()}
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
            >
              <option value="">Client…</option>
              {store.clients.map((c) => {
                const access = evaluateMemberAccess(store, c);
                return (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                    {!access.payment_ok ? ' ⚠ unpaid/issue' : ''}
                  </option>
                );
              })}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="time"
              value={form.time}
              onChange={(e) =>
                setForm((f) => ({ ...f, time: e.target.value }))
              }
            />
            <select
              className={fc()}
              value={form.method}
              onChange={(e) =>
                setForm((f) => ({ ...f, method: e.target.value }))
              }
            >
              <option value="front_desk">Front desk</option>
              <option value="qr_phone">Phone QR</option>
              <option value="app">App</option>
              <option value="class">Class</option>
              <option value="other">Other</option>
            </select>
            <select
              className={fc()}
              value={form.session_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, session_id: e.target.value }))
              }
            >
              <option value="">Session (optional)…</option>
              {store.sessions
                .filter((s) => s.date === form.date)
                .map((s) => {
                  const ct = store.class_types.find(
                    (c) => c.id === s.class_type_id
                  );
                  return (
                    <option key={s.id} value={s.id}>
                      {s.start_time} · {ct?.name}
                    </option>
                  );
                })}
            </select>
          </FormCard>
          <DataTable
            tone="owner"
            headers={[
              'Date',
              'Time',
              'Client',
              'Method',
              'Payment',
              'Alert',
              'Session',
            ]}
            rows={[...store.check_ins]
              .sort((a, b) => {
                const d = b.date.localeCompare(a.date);
                if (d !== 0) return d;
                return String(b.time || '').localeCompare(String(a.time || ''));
              })
              .map((c) => {
                const client = store.clients.find((x) => x.id === c.client_id);
                const ses = store.sessions.find((s) => s.id === c.session_id);
                const ct = store.class_types.find(
                  (t) => t.id === ses?.class_type_id
                );
                const payOk = c.payment_ok !== false && !c.access_alert;
                return {
                  id: c.id,
                  cells: [
                    c.date,
                    c.time || '—',
                    client?.name || c.client_id,
                    c.method || '—',
                    c.access_level === 'blocked'
                      ? 'Blocked'
                      : payOk
                        ? 'OK'
                        : 'Unpaid',
                    c.access_alert ||
                      (c.subscription_status && c.subscription_status !== 'active'
                        ? c.subscription_status
                        : '—'),
                    ct?.name || '—',
                  ],
                };
              })}
            onDelete={(id) =>
              void post({ entity: 'check_ins', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
