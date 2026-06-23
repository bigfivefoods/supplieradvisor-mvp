'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Trash2, Building2, CheckCircle, Clock, 
  DollarSign, FileText 
} from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: number;
  buyer_profile_id: number;
  supplier_id: number;
  total_amount: number;
  status: string;
  description: string | null;
  items: LineItem[] | null;
  onchain_tx: string | null;
  created_at: string;
}

interface Membership {
  profile_id: number;
  profile: { trading_name: string; legal_name: string | null };
}

export default function PurchaseOrdersPage() {
  const { user, signMessage } = usePrivy();

  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unit_price), 0
  );

  // Load companies
  const loadMemberships = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('business_users')
      .select(`
        profile_id,
        profiles:profile_id (trading_name, legal_name)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!data || data.length === 0) return;

    const formatted = data.map((m: any) => ({
      profile_id: m.profile_id,
      profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
    }));

    setMemberships(formatted);

    const storageKey = `supplieradvisor_last_company_${user.id}`;
    const savedId = localStorage.getItem(storageKey);
    const savedProfileId = savedId ? parseInt(savedId) : null;

    const defaultMembership = savedProfileId && formatted.some(m => m.profile_id === savedProfileId)
      ? formatted.find(m => m.profile_id === savedProfileId)!
      : formatted[0];

    setCurrentProfileId(defaultMembership.profile_id);
    setCurrentProfileName(
      defaultMembership.profile?.trading_name || 
      defaultMembership.profile?.legal_name || 
      `Company ${defaultMembership.profile_id}`
    );
  };

  useEffect(() => {
    loadMemberships();
  }, [user?.id]);

  const switchCompany = (membership: Membership) => {
    setCurrentProfileId(membership.profile_id);
    setCurrentProfileName(
      membership.profile?.trading_name || 
      membership.profile?.legal_name || 
      `Company ${membership.profile_id}`
    );
    setShowSwitcher(false);

    if (user?.id) {
      localStorage.setItem(`supplieradvisor_last_company_${user.id}`, membership.profile_id.toString());
    }
  };

  const fetchPurchaseOrders = async () => {
    if (!currentProfileId) return;

    const { data } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('buyer_profile_id', currentProfileId)
      .order('created_at', { ascending: false });

    if (data) setPurchaseOrders(data);
  };

  useEffect(() => {
    if (currentProfileId) fetchPurchaseOrders();
  }, [currentProfileId]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleRaisePO = async () => {
    if (!currentProfileId || !supplierId) {
      alert('Please select a supplier and add line items');
      return;
    }

    setLoading(true);
    try {
      const sigMessage = `SUPPLIERADVISOR PURCHASE ORDER\nBuyer: ${currentProfileName}\nSupplier ID: ${supplierId}\nTotal: R${totalAmount}\nTime: ${new Date().toISOString()}`;
      const signature = await signMessage({ message: sigMessage });

      const { error } = await supabase.from('purchase_orders').insert({
        buyer_profile_id: currentProfileId,
        supplier_id: parseInt(supplierId),
        total_amount: totalAmount,
        description: description || null,
        items: lineItems,
        status: 'sent',
        onchain_tx: signature,
      });

      if (error) throw error;

      alert('✅ Purchase Order raised with onchain signature');
      setSupplierId('');
      setDescription('');
      setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
      fetchPurchaseOrders();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (poId: number, newStatus: string, requireSignature = false) => {
    setLoading(true);
    try {
      let onchainTx = null;

      if (requireSignature) {
        const sigMessage = `SUPPLIERADVISOR PO STATUS UPDATE\nPO #${poId} → ${newStatus.toUpperCase()}\nTime: ${new Date().toISOString()}`;
        onchainTx = await signMessage({ message: sigMessage });
      }

      await supabase
        .from('purchase_orders')
        .update({ 
          status: newStatus,
          ...(onchainTx && { onchain_tx: onchainTx })
        })
        .eq('id', poId);

      fetchPurchaseOrders();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12 px-8 max-w-6xl mx-auto">
        <Breadcrumb />

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Purchase Orders</h1>
            <p className="text-xl text-neutral-600 mt-1">Onchain • Verifiable • Instant</p>
          </div>

          {/* Company Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-3 bg-white border border-neutral-200 rounded-2xl px-4 py-2 hover:border-neutral-300"
            >
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-semibold text-sm">{currentProfileName}</span>
            </button>

            {showSwitcher && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 py-2">
                {memberships.map((m) => (
                  <button
                    key={m.profile_id}
                    onClick={() => switchCompany(m)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 ${m.profile_id === currentProfileId ? 'bg-[#00b4d8]/5' : ''}`}
                  >
                    {m.profile?.trading_name || m.profile?.legal_name || `Company ${m.profile_id}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Raise New PO */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-10 mb-10">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <Plus className="w-7 h-7 text-[#00b4d8]" /> Raise New Purchase Order
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium mb-2">Supplier Profile ID</label>
              <input
                type="number"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8]"
                placeholder="e.g. 42"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8]"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold">Line Items</div>
              <button onClick={addLineItem} className="text-[#00b4d8] text-sm flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 mb-3 items-center">
                <input
                  className="col-span-6 px-4 py-3 border border-neutral-200 rounded-2xl"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                />
                <input
                  type="number"
                  className="col-span-2 px-4 py-3 border border-neutral-200 rounded-2xl"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                />
                <input
                  type="number"
                  className="col-span-3 px-4 py-3 border border-neutral-200 rounded-2xl"
                  placeholder="Unit Price"
                  value={item.unit_price}
                  onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                />
                <button onClick={() => removeLineItem(index)} className="col-span-1 text-red-500 hover:text-red-600">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t pt-6">
            <div className="text-2xl font-bold">
              Total: <span className="text-[#00b4d8]">R{totalAmount.toLocaleString()}</span>
            </div>
            <button
              onClick={handleRaisePO}
              disabled={loading || !supplierId}
              className="px-10 py-4 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300 flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              {loading ? 'Signing onchain...' : 'Raise PO + Onchain Signature'}
            </button>
          </div>
        </div>

        {/* List of POs */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-10">
          <h2 className="text-3xl font-bold mb-8">Your Purchase Orders</h2>

          {purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">No purchase orders yet.</div>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="border border-neutral-200 rounded-2xl p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-xl">PO #{po.id} • Supplier {po.supplier_id}</div>
                      <div className="text-neutral-600 mt-1">{po.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#00b4d8]">R{po.total_amount.toLocaleString()}</div>
                      <div className="text-sm mt-1 capitalize flex items-center justify-end gap-1">
                        {po.status}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    {po.status === 'sent' && (
                      <>
                        <button onClick={() => updateStatus(po.id, 'accepted', true)} className="px-5 py-2 bg-blue-600 text-white rounded-2xl text-sm font-medium">Accept</button>
                        <button onClick={() => updateStatus(po.id, 'rejected')} className="px-5 py-2 bg-red-600 text-white rounded-2xl text-sm font-medium">Reject</button>
                      </>
                    )}
                    {po.status === 'accepted' && (
                      <button onClick={() => updateStatus(po.id, 'paid', true)} className="px-5 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Mark as Paid
                      </button>
                    )}
                    {po.onchain_tx && (
                      <span className="px-4 py-2 text-xs bg-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Onchain verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}