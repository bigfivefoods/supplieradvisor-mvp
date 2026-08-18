'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import {
  PracticeScheduleCalendar,
} from '@/components/schedule/PracticeScheduleCalendar';
import { ScheduleEventPeek } from '@/components/schedule/ScheduleEventPeek';
import { HIRE_CATEGORIES } from '@/lib/hire/hiregraph';
import {
  bookingFromEventId,
  hireBookingsToScheduleEvents,
} from '@/lib/hire/calendar-events';
import { durationLabel } from '@/lib/hire/availability';
import { AdvisorVisitInvoiceCard } from '@/components/advisors/AdvisorVisitInvoiceCard';

export default function HireCalendarPage() {
  const { companyId, store, loading } = useHiregraph();
  const [categoryId, setCategoryId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const usedCats = useMemo(() => {
    if (!store) return [];
    const ids = new Set(
      store.bookings
        .map((b) => b.category_id)
        .concat(store.items.map((i) => i.category_id))
        .filter(Boolean) as string[]
    );
    return HIRE_CATEGORIES.filter((c) => ids.has(c.id));
  }, [store]);

  const events = useMemo(
    () => (store ? hireBookingsToScheduleEvents(store, categoryId || null) : []),
    [store, categoryId]
  );

  const open = store && openId ? bookingFromEventId(store, openId) : null;
  const openItem = open
    ? store?.items.find((i) => i.id === open.item_id)
    : null;

  return (
    <HiregraphWorkbench
      title="Hire calendar"
      titleAccent="who has what, when"
      description="Every hire on a day / week / month grid. Toggle a category to see only plant, vehicles, kids party, tools… Click a block for duration and whether it can be extended."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryId('')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                !categoryId
                  ? 'bg-cyan-700 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              All categories
            </button>
            {usedCats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                  categoryId === c.id
                    ? 'bg-cyan-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {c.short}
              </button>
            ))}
          </div>

          <PracticeScheduleCalendar
            title="Hire diary"
            printBrand="HireAdvisor · SupplierAdvisor"
            accent="teal"
            events={events}
            peopleLabel="Category"
            emptyLabel="Nothing hired"
            slotHint="Hired items appear on their dates"
            selectedEventId={openId}
            onSelectEvent={(ev) => setOpenId(ev.id)}
            defaultView="month"
          />

          <ScheduleEventPeek
            open={Boolean(open)}
            title={open?.item_title || 'Hire'}
            subtitle={
              open
                ? durationLabel(
                    open.start_date,
                    open.end_date,
                    open.units,
                    openItem?.rate_unit
                  )
                : undefined
            }
            onClose={() => setOpenId(null)}
          >
            {open ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>{open.customer_name || 'Customer'}</strong> ·{' '}
                  {open.status}
                </p>
                <p className="text-slate-600">
                  {open.start_date} → {open.end_date || open.start_date} ·{' '}
                  {open.units} {openItem?.rate_unit || 'day'}
                  {(open.units || 1) === 1 ? '' : 's'}
                </p>
                {open.customer_pays_zar != null ? (
                  <p className="font-black">
                    Customer pays R
                    {Number(open.customer_pays_zar).toLocaleString('en-ZA')}
                  </p>
                ) : null}
                {String(open.crm_customer_id || open.customer_id || '') ? (
                  <AdvisorVisitInvoiceCard
                    companyId={companyId}
                    module="hiregraph"
                    refId={String(open.crm_customer_id || open.customer_id)}
                    memberName={open.customer_name || 'Customer'}
                    description={`${open.item_title || 'Hire'} · ${open.start_date || ''}`}
                    amountZar={
                      Number(open.customer_pays_zar || open.rental_zar || 0)
                    }
                    dueDate={open.end_date || open.start_date || null}
                    sourceId={`hire:${open.id}`}
                    accountsHref="/dashboard/hiregraph/accounts"
                    btnClass="bg-cyan-700 hover:bg-cyan-800"
                    accentClass="border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/20"
                  />
                ) : (
                  <p className="text-[12px] text-slate-500">
                    Link this hire to a customer to send an invoice.
                  </p>
                )}
                <Link
                  href="/dashboard/hiregraph/bookings"
                  className="inline-block text-xs font-bold text-cyan-800 underline"
                >
                  Open bookings desk
                </Link>
              </div>
            ) : null}
          </ScheduleEventPeek>
        </div>
      )}
    </HiregraphWorkbench>
  );
}
