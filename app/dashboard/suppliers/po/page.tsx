'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Plus, Trash2, Building2, CheckCircle, DollarSign, FileText, Search, Wallet } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { parseEther, parseEventLogs } from 'viem';
import POEscrowV2ABI from '../../../../src/lib/contracts/abi/POEscrowV2.json';

const PO_ESCROW_ADDRESS = '0x1a0a30b07ad50b5373a088d5c81dbbf3e644a06f' as const;

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
  onchain_po_id?: number | null;
  created_at: string;
}

interface Membership {
  profile_id: number;
  trading_name: string;
}

interface SupplierProfile {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
}

export default function PurchaseOrdersPage() {
  const { user, signMessage } = usePrivy();
  const { address: connectedWallet } = useAccount();
  const publicClient = usePublicClient();

  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [supplierWallet, setSupplierWallet] = useState('');
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [lookingUpSupplier, setLookingUpSupplier] = useState(false);
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const { writeContract, data: txHash, isPending: isContractPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Load company memberships
  const loadMemberships = async () => {
    if (!user?.id) return;
    const { data: businessUsers } = await supabase.from('business_users').select('profile_id').eq('user_id', user.id).eq('status', 'active');
    if (!businessUsers || businessUsers.length === 0) return;
    const profileIds = businessUsers.map((b: any) => b.profile_id);
    const { data: profiles } = await supabase.from('profiles').select('id, trading_name, legal_name').in('id', profileIds);
    const formatted: Membership[] = businessUsers.map((bu: any) => {
      const profile = profiles?.find((p: any) => p.id === bu.profile_id);
      return { profile_id: bu.profile_id, trading_name: profile?.trading_name || profile?.legal_name || `Company ${bu.profile_id}` };
    });
    setMemberships(formatted);
    const first = formatted[0];
    setCurrentProfileId(first.profile_id);
    setCurrentProfileName(first.trading_name);
  };

  useEffect(() => { loadMemberships(); }, [user?.id]);

  const lookupSupplier = async (id: string) => {
    if (!id) { setSupplierProfile(null); return; }
    setLookingUpSupplier(true);
    const { data } = await supabase.from('profiles').select('id, trading_name, legal_name').eq('id', parseInt(id)).single();
    if (data) setSupplierProfile({ id: data.id, trading_name: data.trading_name, legal_name: data.legal_name });
    else setSupplierProfile(null);
    setLookingUpSupplier(false);
  };

  const handleSupplierIdChange = (value: string) => { setSupplierId(value); lookupSupplier(value); };
  const switchCompany = (m: Membership) => { setCurrentProfileId(m.profile_id); setCurrentProfileName(m.trading_name); setShowSwitcher(false); };

  const fetchPurchaseOrders = async () => {
    if (!currentProfileId) return;
    const { data } = await supabase.from('purchase_orders').select('*').eq('buyer_profile_id', currentProfileId).order('created_at', { ascending: false });
    if (data) setPurchaseOrders(data);
  };

  useEffect(() => { if (currentProfileId) fetchPurchaseOrders(); }, [currentProfileId]);

  const addLineItem = () => setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  const removeLineItem = (index: number) => { if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== index)); };
  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems]; updated[index] = { ...updated[index], [field]: value }; setLineItems(updated);
  };

  // ==================== RAISE PURCHASE ORDER ====================
  const handleRaisePO = async () => {
    if (!currentProfileId || !supplierId || !supplierWallet) {
      alert('Please select a supplier and enter their wallet address');
      return;
    }

    setLoading(true);
    try {
      const sigMessage = `SUPPLIERADVISOR PURCHASE ORDER\nBuyer: ${currentProfileName}\nSupplier: ${supplierProfile?.trading_name || supplierId}\nTotal: R${totalAmount}`;
      const signature = await signMessage({ message: sigMessage });

      const { data: newPO, error } = await supabase.from('purchase_orders').insert({
        buyer_profile_id: currentProfileId,
        supplier_id: parseInt(supplierId),
        total_amount: totalAmount,
        description: description || null,
        items: lineItems,
        status: 'sent',
        onchain_tx: signature,
      }).select().single();

      if (error) throw error;

      // Convert Rand to ETH (using ~R55,000 per ETH)
      const ethRate = 55000;
      const amountInEth = (totalAmount / ethRate).toFixed(6);
      const metadataURI = `https://supplieradvisor.app/po/${newPO.id}`;

      (window as any).__pendingSupabasePoId = newPO.id;

      writeContract({
        address: PO_ESCROW_ADDRESS,
        abi: POEscrowV2ABI.abi as any,
        functionName: 'createPO',
        args: [
          supplierWallet as `0x${string}`,
          parseEther(amountInEth),
          metadataURI,
        ],
      });

      alert(`✅ PO created in Supabase + submitted onchain (${amountInEth} ETH). Waiting for confirmation...`);

      setSupplierId('');
      setSupplierWallet('');
      setSupplierProfile(null);
      setDescription('');
      setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);

    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== AUTO-SAVE ONCHAIN PO ID (FIXED) ====================
  useEffect(() => {
    const linkOnchainPoId = async () => {
      if (!isConfirmed || !txHash || !publicClient) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        const parsedLogs = parseEventLogs({
          abi: POEscrowV2ABI.abi as any,
          eventName: 'POCreated',
          logs: receipt.logs,
        });

        const pendingSupabaseId = (window as any).__pendingSupabasePoId;

        if (parsedLogs.length > 0 && pendingSupabaseId) {
          // Safe access to args (fixes TypeScript error)
          const eventArgs = (parsedLogs[0] as any).args;
          const poId = Number(eventArgs?.poId ?? eventArgs?.[0]);

          if (poId) {
            await supabase.from('purchase_orders').update({ onchain_po_id: poId }).eq('id', pendingSupabaseId);
            fetchPurchaseOrders();
            delete (window as any).__pendingSupabasePoId;

            alert(`✅ Onchain PO #${poId} created and linked successfully!`);
          }
        }
      } catch (error) {
        console.error('Failed to link onchain PO ID:', error);
      }
    };

    linkOnchainPoId();
  }, [isConfirmed, txHash, publicClient]);

  // ==================== FUND ONCHAIN PO ====================
  const fundOnchainPO = async (onchainPoId: number, totalAmountRand: number) => {
    if (!connectedWallet) {
      alert('Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      const ethRate = 55000;
      const amountInEth = (totalAmountRand / ethRate).toFixed(6);

      writeContract({
        address: PO_ESCROW_ADDRESS,
        abi: POEscrowV2ABI.abi as any,
        functionName: 'fundPO',
        args: [BigInt(onchainPoId)],
        value: parseEther(amountInEth),
      });

      alert(`Funding PO #${onchainPoId} with ${amountInEth} ETH...`);
    } catch (err: any) {
      alert('Error funding PO: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== UPDATE STATUS ====================
  const updateStatus = async (poId: number, newStatus: string, requireSignature = false) => {
    setLoading(true);
    try {
      let onchainTx = null;
      if (requireSignature) {
        const sigMessage = `SUPPLIERADVISOR PO STATUS UPDATE\nPO #${poId} → ${newStatus.toUpperCase()}`;
        onchainTx = await signMessage({ message: sigMessage });
      }
      await supabase.from('purchase_orders').update({ status: newStatus, ...(onchainTx && { onchain_tx: onchainTx }) }).eq('id', poId);
      fetchPurchaseOrders();
    } catch (err: any) {
      alert('Error: ' + err.message);
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

          <div className="relative">
            <button onClick={() => setShowSwitcher(!showSwitcher)} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-2xl px-4 py-2 hover:border-neutral-300">
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-semibold text-sm">{currentProfileName}</span>
            </button>
            {showSwitcher && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 py-2">
                {memberships.map((m) => (
                  <button key={m.profile_id} onClick={() => switchCompany(m)} className={`w-full text-left px-4 py-3 hover:bg-neutral-50 ${m.profile_id === currentProfileId ? 'bg-[#00b4d8]/5' : ''}`}>
                    {m.trading_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Raise New PO */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-10 mb-10">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3"><Plus className="w-7 h-7 text-[#00b4d8]" /> Raise New Purchase Order</h2>

          <div className="mb-8">
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Supplier Wallet Address (for onchain escrow)
            </label>
            <input type="text" value={supplierWallet} onChange={(e) => setSupplierWallet(e.target.value)} className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] font-mono" placeholder="0x..." />
            <p className="text-xs text-neutral-500 mt-1">This is the wallet that will receive payment when milestones are released.</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium mb-2">Supplier Profile ID</label>
            <div className="relative">
              <input type="number" value={supplierId} onChange={(e) => handleSupplierIdChange(e.target.value)} className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8]" placeholder="e.g. 102" />
              {lookingUpSupplier && <Search className="absolute right-4 top-4 w-5 h-5 text-neutral-400 animate-pulse" />}
            </div>
            {supplierProfile && (
              <div className="mt-4 p-6 bg-neutral-50 rounded-2xl border border-neutral-200">
                <div className="font-semibold text-lg mb-3">Supplier Details</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div><span className="text-neutral-500">Trading Name:</span> {supplierProfile.trading_name || '—'}</div>
                  <div><span className="text-neutral-500">Legal Name:</span> {supplierProfile.legal_name || '—'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8]" placeholder="Delivery instructions, payment terms..." />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold">Line Items</div>
              <button onClick={addLineItem} className="text-[#00b4d8] text-sm flex items-center gap-1 hover:underline"><Plus className="w-4 h-4" /> Add Item</button>
            </div>
            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 mb-3 items-center">
                <input className="col-span-6 px-4 py-3 border border-neutral-200 rounded-2xl" placeholder="Item description" value={item.description} onChange={(e) => updateLineItem(index, 'description', e.target.value)} />
                <input type="number" className="col-span-2 px-4 py-3 border border-neutral-200 rounded-2xl" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                <input type="number" className="col-span-3 px-4 py-3 border border-neutral-200 rounded-2xl" placeholder="Unit Price (R)" value={item.unit_price} onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                <button onClick={() => removeLineItem(index)} className="col-span-1 text-red-500 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t pt-6">
            <div className="text-2xl font-bold">Total: <span className="text-[#00b4d8]">R{totalAmount.toLocaleString()}</span></div>
            <button onClick={handleRaisePO} disabled={loading || isContractPending || !supplierId || !supplierWallet} className="px-10 py-4 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {loading || isContractPending ? 'Creating Onchain...' : 'Raise PO + Create Onchain Escrow'}
            </button>
          </div>
        </div>

        {/* Existing POs */}
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
                      {po.onchain_po_id && <div className="text-xs text-emerald-600 mt-1">Onchain ID: {po.onchain_po_id}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#00b4d8]">R{po.total_amount.toLocaleString()}</div>
                      <div className="text-sm mt-1 capitalize">{po.status}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-6">
                    {po.status === 'sent' && (
                      <>
                        <button onClick={() => updateStatus(po.id, 'accepted', true)} className="px-5 py-2 bg-blue-600 text-white rounded-2xl text-sm font-medium">Accept</button>
                        <button onClick={() => updateStatus(po.id, 'rejected')} className="px-5 py-2 bg-red-600 text-white rounded-2xl text-sm font-medium">Reject</button>
                      </>
                    )}
                    {po.status === 'accepted' && (
                      <button onClick={() => updateStatus(po.id, 'paid', true)} className="px-5 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-medium flex items-center gap-2"><DollarSign className="w-4 h-4" /> Mark as Paid</button>
                    )}

                    {/* Fund PO Button */}
                    {po.onchain_po_id && po.status !== 'paid' && po.status !== 'completed' && (
                      <button onClick={() => fundOnchainPO(po.onchain_po_id!, po.total_amount)} disabled={loading || isContractPending} className="px-5 py-2 bg-[#00b4d8] text-white rounded-2xl text-sm font-medium flex items-center gap-2 hover:bg-[#0099b8] disabled:bg-neutral-300">
                        <Wallet className="w-4 h-4" /> Fund PO (Escrow)
                      </button>
                    )}

                    {po.onchain_tx && <span className="px-4 py-2 text-xs bg-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Onchain verified</span>}
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