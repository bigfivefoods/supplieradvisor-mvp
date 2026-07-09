'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/utils/supabase/client';
import {
  Plus,
  Trash2,
  Building2,
  FileText,
  X,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { BUYER_PO_CANCEL_STATUSES } from '@/lib/procurement/types';

interface LineItem {
  product_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom: string | null;
}

interface ConnectedSupplier {
  connectionId: number;
  supplierProfileId: number;
  trading_name: string | null;
  legal_name: string | null;
  suspended: boolean;
}

interface PurchaseOrder {
  id: number;
  buyer_profile_id: number;
  supplier_id?: number | null;
  supplier_profile_id?: number | null;
  total_amount?: number | null;
  subtotal?: number | null;
  status: string;
  description: string | null;
  items?: LineItem[] | null;
  currency?: string | null;
  created_at: string;
}

export default function BuyerPurchaseOrdersPage() {
  const { user } = usePrivy();
  const supabase = createClient();
  const companyId = getSelectedCompanyId();
  const companyName = getSelectedCompanyName();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<ConnectedSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: null },
  ]);

  const totalAmount = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [lineItems]
  );

  const selectedSupplier = suppliers.find((s) => s.supplierProfileId === selectedSupplierId) || null;

  const loadSuppliers = useCallback(async () => {
    if (!companyId) return;
    // Buyer is requestee; seller (supplier) is requester; type=customer
    const { data: conns, error } = await supabase
      .from('business_connections')
      .select('id, requester_profile_id, requestee_profile_id, status, connection_type, metadata')
      .eq('requestee_profile_id', companyId)
      .eq('connection_type', 'customer')
      .eq('status', 'accepted');

    if (error) {
      console.error(error);
      toast.error('Failed to load connected suppliers');
      return;
    }

    const rows = conns || [];
    const supplierIds = rows.map((c: { requester_profile_id: number }) => c.requester_profile_id);
    let profiles: { id: number; trading_name: string | null; legal_name: string | null }[] = [];
    if (supplierIds.length) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', supplierIds);
      profiles = p || [];
    }

    const list: ConnectedSupplier[] = rows.map(
      (c: {
        id: number;
        requester_profile_id: number;
        metadata?: Record<string, unknown> | null;
      }) => {
        const meta =
          c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
            ? c.metadata
            : {};
        const profile = profiles.find((p) => p.id === c.requester_profile_id);
        return {
          connectionId: c.id,
          supplierProfileId: c.requester_profile_id,
          trading_name: profile?.trading_name ?? null,
          legal_name: profile?.legal_name ?? null,
          suspended: meta.suspended === true || meta.suspended === 'true',
        };
      }
    );
    setSuppliers(list);
  }, [companyId, supabase]);

  const loadPOs = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    const params = new URLSearchParams({
      buyerCompanyId: String(companyId),
      privyUserId,
    });
    const res = await fetch(`/api/buyer/purchase-orders?${params}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed to load purchase orders');
      return;
    }
    setPurchaseOrders(json.purchaseOrders || []);
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadSuppliers(), loadPOs()]).finally(() => setLoading(false));
  }, [companyId, loadSuppliers, loadPOs]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: null },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | null) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleRaisePO = async () => {
    if (!companyId || !privyUserId) {
      toast.error('Select a company and sign in');
      return;
    }
    if (!selectedSupplierId || !selectedSupplier) {
      toast.error('Please select a connected supplier');
      return;
    }
    if (selectedSupplier.suspended) {
      toast.error('Connection is suspended — cannot raise new POs');
      return;
    }
    const validItems = lineItems.filter((i) => i.item_name.trim());
    if (!validItems.length) {
      toast.error('Add at least one line item with a name');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/buyer/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCompanyId: companyId,
          supplierProfileId: selectedSupplierId,
          privyUserId,
          description: description || null,
          currency: 'ZAR',
          items: validItems.map((i) => ({
            product_id: i.product_id,
            item_name: i.item_name.trim(),
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.unit_price) || 0,
            uom: i.uom,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to create PO');
        return;
      }
      toast.success(`Purchase order #${json.purchaseOrder?.id ?? ''} created`);
      setSelectedSupplierId(null);
      setDescription('');
      setLineItems([{ product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: null }]);
      await loadPOs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error creating PO');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (poId: number) => {
    if (!companyId || !privyUserId) return;
    if (!confirm(`Cancel PO #${poId}?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCompanyId: companyId,
          privyUserId,
          id: poId,
          status: 'cancelled',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to cancel');
        return;
      }
      toast.success('PO cancelled');
      await loadPOs();
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to raise purchase orders.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-10 px-6 max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-2px] text-[#00b4d8]">
              Raise purchase order
            </h1>
            <p className="text-neutral-600 mt-2 text-sm">
              Connected suppliers only · off-chain PO (escrow is a later PR)
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-4 py-2">
            <Building2 className="w-4 h-4 text-[#00b4d8]" />
            <span className="font-semibold text-sm">{companyName}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <>
            {/* Raise form */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Plus className="w-6 h-6 text-[#00b4d8]" /> New purchase order
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Connected supplier</label>
                {suppliers.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No accepted customer connections yet. Accept a supplier invite first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {suppliers.map((s) => {
                      const name = s.trading_name || s.legal_name || `Supplier ${s.supplierProfileId}`;
                      const selected = selectedSupplierId === s.supplierProfileId;
                      return (
                        <button
                          key={s.connectionId}
                          type="button"
                          disabled={s.suspended}
                          onClick={() => setSelectedSupplierId(s.supplierProfileId)}
                          className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center justify-between ${
                            selected
                              ? 'border-[#00b4d8] bg-[#00b4d8]/5'
                              : s.suspended
                                ? 'border-neutral-100 bg-neutral-50 opacity-60 cursor-not-allowed'
                                : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-neutral-500">ID {s.supplierProfileId}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.suspended && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Suspended
                              </span>
                            )}
                            {selected && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSupplierId(null);
                                }}
                                className="text-neutral-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-2xl focus:border-[#00b4d8]"
                  placeholder="Delivery instructions, payment terms..."
                />
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold">Line items</div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-[#00b4d8] text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add item
                  </button>
                </div>
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 rounded-2xl p-4 mb-3 grid grid-cols-1 sm:grid-cols-12 gap-3"
                  >
                    <div className="sm:col-span-5">
                      <label className="text-xs text-neutral-500">Item name</label>
                      <input
                        value={item.item_name}
                        onChange={(e) => updateLineItem(index, 'item_name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl"
                        placeholder="Product or service"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-neutral-500">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, 'quantity', parseFloat(e.target.value) || 1)
                        }
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-neutral-500">Unit price (R)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-neutral-500">UOM</label>
                      <input
                        value={item.uom || ''}
                        onChange={(e) => updateLineItem(index, 'uom', e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl"
                        placeholder="unit"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end justify-end">
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-right text-xl font-bold mt-2">
                  Total:{' '}
                  <span className="text-[#00b4d8]">R{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end border-t pt-6">
                <button
                  type="button"
                  onClick={handleRaisePO}
                  disabled={
                    saving ||
                    !selectedSupplierId ||
                    !!selectedSupplier?.suspended ||
                    suppliers.length === 0
                  }
                  className="px-8 py-3 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300 flex items-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  {saving ? 'Creating...' : 'Raise purchase order'}
                </button>
              </div>
            </div>

            {/* Existing POs */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <h2 className="text-2xl font-bold mb-6">Your purchase orders</h2>
              {purchaseOrders.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-sm">
                  No purchase orders yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {purchaseOrders.map((po) => {
                    const amount = Number(po.total_amount ?? po.subtotal ?? 0);
                    const canCancel = (BUYER_PO_CANCEL_STATUSES as readonly string[]).includes(
                      po.status
                    );
                    const supplier =
                      po.supplier_profile_id || po.supplier_id
                        ? suppliers.find(
                            (s) =>
                              s.supplierProfileId === po.supplier_profile_id ||
                              s.supplierProfileId === po.supplier_id
                          )
                        : null;
                    const supplierLabel =
                      supplier?.trading_name ||
                      supplier?.legal_name ||
                      `Supplier ${po.supplier_profile_id || po.supplier_id || '?'}`;
                    return (
                      <div
                        key={po.id}
                        className="border border-neutral-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-lg">
                            PO #{po.id} · {supplierLabel}
                          </div>
                          {po.description && (
                            <div className="text-neutral-600 text-sm mt-0.5">{po.description}</div>
                          )}
                          <div className="text-xs text-neutral-400 mt-1">
                            {po.created_at
                              ? new Date(po.created_at).toLocaleString()
                              : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xl font-bold text-[#00b4d8]">
                              R{amount.toLocaleString()}
                            </div>
                            <div className="text-sm capitalize text-neutral-600">{po.status}</div>
                          </div>
                          {canCancel && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleCancel(po.id)}
                              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
