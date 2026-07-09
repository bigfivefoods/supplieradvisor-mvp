'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, CheckCircle, DollarSign, XCircle, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import DocumentWorkspace from '@/components/customers/DocumentWorkspace';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { SELLER_PO_TRANSITIONS } from '@/lib/procurement/types';

type Tab = 'sales' | 'inbound';

interface InboundPO {
  id: number;
  buyer_profile_id?: number | null;
  supplier_id?: number | null;
  supplier_profile_id?: number | null;
  seller_customer_id?: number | null;
  total_amount?: number | null;
  subtotal?: number | null;
  status: string;
  description?: string | null;
  currency?: string | null;
  source?: string | null;
  created_at?: string;
  items?: unknown;
}

const ACTION_LABELS: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  accepted: {
    label: 'Accept',
    className: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: CheckCircle,
  },
  paid: {
    label: 'Mark paid',
    className: 'bg-emerald-600 text-white hover:bg-emerald-700',
    icon: DollarSign,
  },
  completed: {
    label: 'Complete',
    className: 'bg-teal-600 text-white hover:bg-teal-700',
    icon: PackageCheck,
  },
  cancelled: {
    label: 'Cancel',
    className: 'bg-red-600 text-white hover:bg-red-700',
    icon: XCircle,
  },
};

function OrdersTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        type="button"
        onClick={() => setTab('sales')}
        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
          tab === 'sales'
            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
        }`}
      >
        Sales orders
      </button>
      <button
        type="button"
        onClick={() => setTab('inbound')}
        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
          tab === 'inbound'
            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
        }`}
      >
        Inbound POs
      </button>
    </div>
  );
}

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('sales');

  if (tab === 'sales') {
    return (
      <DocumentWorkspace
        type="order"
        beforeHeader={<OrdersTabs tab={tab} setTab={setTab} />}
      />
    );
  }

  return (
    <CompanyRequired>
      <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
        <CustomersHeader
          title="Orders"
          description="Sales orders you issue, and inbound purchase orders from connected customers."
        />
        <OrdersTabs tab={tab} setTab={setTab} />
        <InboundPosList />
      </div>
    </CompanyRequired>
  );
}

function InboundPosList() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId()!;
  const privyUserId = getCanonicalUserId(user?.id);
  const [pos, setPos] = useState<InboundPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [buyerNames, setBuyerNames] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      setPos([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/customers/purchase-orders?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load inbound POs');
        setPos([]);
        return;
      }
      const list: InboundPO[] = json.purchaseOrders || [];
      setPos(list);

      const buyerIds = Array.from(
        new Set(
          list
            .map((p) => p.buyer_profile_id)
            .filter((id): id is number => id != null && Number.isFinite(Number(id)))
        )
      );
      if (buyerIds.length) {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .in('id', buyerIds);
        const map: Record<number, string> = {};
        for (const p of data || []) {
          map[p.id] = p.trading_name || p.legal_name || `Buyer ${p.id}`;
        }
        setBuyerNames(map);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = async (poId: number, status: string) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusyId(poId);
    try {
      const res = await fetch('/api/customers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: poId,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Transition failed');
        return;
      }
      toast.success(`PO #${poId} → ${status}`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
      <h2 className="text-xl font-bold mb-1">Inbound purchase orders</h2>
      <p className="text-sm text-neutral-500 mb-6">
        Accept, mark paid, complete, or cancel POs raised by connected buyers. Paid and completed
        unlock post-PO reviews.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : pos.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 text-sm">
          No inbound purchase orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po) => {
            const amount = Number(po.total_amount ?? po.subtotal ?? 0);
            const allowed = SELLER_PO_TRANSITIONS[po.status] || [];
            const buyerLabel =
              (po.buyer_profile_id && buyerNames[po.buyer_profile_id]) ||
              (po.buyer_profile_id ? `Buyer ${po.buyer_profile_id}` : 'Unknown buyer');
            return (
              <div
                key={po.id}
                className="border border-neutral-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-lg">
                    PO #{po.id} · {buyerLabel}
                  </div>
                  {po.description && (
                    <div className="text-sm text-neutral-600 mt-0.5 truncate">{po.description}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-neutral-500">
                    <span className="capitalize px-2 py-0.5 rounded-full bg-neutral-100">
                      {po.status}
                    </span>
                    {po.source && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                        {po.source}
                      </span>
                    )}
                    {po.seller_customer_id != null && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                        CRM #{po.seller_customer_id}
                      </span>
                    )}
                    {po.created_at && <span>{new Date(po.created_at).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-right sm:mr-2">
                    <div className="text-2xl font-bold text-[#00b4d8]">
                      R{amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowed.map((next) => {
                      const cfg = ACTION_LABELS[next] || {
                        label: next,
                        className: 'bg-neutral-700 text-white',
                        icon: CheckCircle,
                      };
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={next}
                          type="button"
                          disabled={busyId === po.id}
                          onClick={() => transition(po.id, next)}
                          className={`px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 ${cfg.className}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </button>
                      );
                    })}
                    {allowed.length === 0 && (
                      <span className="text-xs text-neutral-400 self-center">No actions</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
