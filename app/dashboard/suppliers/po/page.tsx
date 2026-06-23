'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/utils/supabase/client';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Plus, Trash2, Building2, CheckCircle, DollarSign, FileText, Search, Wallet, X } from 'lucide-react';
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
  supplier_wallet?: string | null;
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
  is_verified?: boolean;
  wallet_address?: string | null;
  status?: string;
}

export default function PurchaseOrdersPage() {
  const { user, signMessage } = usePrivy();
  const { address: connectedWallet } = useAccount();
  const publicClient = usePublicClient();
  const supabase = createClient();   // ← Correct way

  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Supplier Search + Filters
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<SupplierProfile[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);
  const [showSupplierResults, setShowSupplierResults] = useState(false);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);

  const [filters, setFilters] = useState({
    verifiedOnly: false,
    hasWallet: false,
    activeOnly: false,
  });

  const [supplierWallet, setSupplierWallet] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const { writeContract, data: txHash, isPending: isContractPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // ==================== LIVE SEARCH + FILTER ====================
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (supplierSearch.length >= 2) {
        searchSuppliers(supplierSearch);
      } else {
        setSupplierResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [supplierSearch, filters]);

  // ==================== LOAD MEMBERSHIPS ====================
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

  // ==================== SUPPLIER SEARCH ====================
  const searchSuppliers = async (query: string) => {
    if (!query || query.length < 2) {
      setSupplierResults([]);
      return;
    }

    setSearchingSuppliers(true);

    let queryBuilder = supabase
      .from('profiles')
      .select('id, trading_name, legal_name, is_verified, wallet_address, status')
      .or(`trading_name.ilike.%${query}%,legal_name.ilike.%${query}%`)
      .limit(10);

    if (filters.verifiedOnly) queryBuilder = queryBuilder.eq('is_verified', true);
    if (filters.hasWallet) queryBuilder = queryBuilder.not('wallet_address', 'is', null);
    if (filters.activeOnly) queryBuilder = queryBuilder.eq('status', 'active');

    const { data } = await queryBuilder;
    setSupplierResults(data || []);
    setSearchingSuppliers(false);
  };

  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearch(value);
    setSelectedSupplier(null);
    setShowSupplierResults(true);
  };

  const selectSupplier = (supplier: SupplierProfile) => {
    setSelectedSupplier(supplier);
    setSupplierSearch(supplier.trading_name || supplier.legal_name || '');
    setShowSupplierResults(false);
    setSupplierResults([]);
  };

  const clearSelectedSupplier = () => {
    setSelectedSupplier(null);
    setSupplierSearch('');
    setSupplierResults([]);
    setShowSupplierResults(false);
  };

  const switchCompany = (m: Membership) => {
    setCurrentProfileId(m.profile_id);
    setCurrentProfileName(m.trading_name);
    setShowSwitcher(false);
  };

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

  // ==================== RAISE PURCHASE ORDER (HYBRID) ====================
  const handleRaisePO = async () => {
    if (!currentProfileId || !selectedSupplier) {
      alert('Please select a supplier');
      return;
    }

    setLoading(true);
    try {
      const sigMessage = `SUPPLIERADVISOR PURCHASE ORDER\nBuyer: ${currentProfileName}\nSupplier: ${selectedSupplier.trading_name || selectedSupplier.legal_name}\nTotal: R${totalAmount}`;
      const signature = await signMessage({ message: sigMessage });

      const { data: newPO, error } = await supabase.from('purchase_orders').insert({
        buyer_profile_id: currentProfileId,
        supplier_id: selectedSupplier.id,
        total_amount: totalAmount,
        description: description || null,
        items: lineItems,
        status: 'sent',
        onchain_tx: signature,
        supplier_wallet: supplierWallet || null,
      }).select().single();

      if (error) throw error;

      if (supplierWallet) {
        const ethRate = 55000;
        const amountInEth = (totalAmount / ethRate).toFixed(6);
        const metadataURI = `https://supplieradvisor.app/po/${newPO.id}`;

        (window as any).__pendingSupabasePoId = newPO.id;

        writeContract({
          address: PO_ESCROW_ADDRESS,
          abi: POEscrowV2ABI.abi as any,
          functionName: 'createPO',
          args: [supplierWallet as `0x${string}`, parseEther(amountInEth), metadataURI],
        });

        alert(`✅ PO created + Onchain Escrow submitted (${amountInEth} ETH). Waiting for confirmation...`);
      } else {
        alert('✅ Purchase Order created successfully (Standard PO - no onchain escrow yet)');
      }

      setSelectedSupplier(null);
      setSupplierSearch('');
      setSupplierWallet('');
      setDescription('');
      setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
      fetchPurchaseOrders();

    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CREATE ONCHAIN ESCROW FOR EXISTING PO ====================
  const createOnchainEscrow = async (po: PurchaseOrder) => {
    if (!po.supplier_wallet) {
      const wallet = prompt('Enter supplier wallet address to create onchain escrow:');
      if (!wallet) return;
      await supabase.from('purchase_orders').update({ supplier_wallet: wallet }).eq('id', po.id);
      po.supplier_wallet = wallet;
    }

    setLoading(true);
    try {
      const ethRate = 55000;
      const amountInEth = (po.total_amount / ethRate).toFixed(6);
      const metadataURI = `https://supplieradvisor.app/po/${po.id}`;

      (window as any).__pendingSupabasePoId = po.id;

      writeContract({
        address: PO_ESCROW_ADDRESS,
        abi: POEscrowV2ABI.abi as any,
        functionName: 'createPO',
        args: [po.supplier_wallet as `0x${string}`, parseEther(amountInEth), metadataURI],
      });

      alert(`Creating onchain escrow for PO #${po.id}...`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== AUTO-LINK ONCHAIN PO ID ====================
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
          const eventArgs = (parsedLogs[0] as any).args;
          const poId = Number(eventArgs?.poId ?? eventArgs?.[0]);

          if (poId) {
            await supabase.from('purchase_orders').update({ onchain_po_id: poId }).eq('id', pendingSupabaseId);
            fetchPurchaseOrders();
            delete (window as any).__pendingSupabasePoId;
            alert(`✅ Onchain Escrow created and linked! PO #${poId}`);
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
            
            {/* Onchain vs Standard Badge */}
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                Standard PO
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#00b4d8]/10 text-[#00b4d8]">
                Onchain Escrow
              </span>
              <span className="text-xs text-neutral-500 ml-1">Hybrid Mode</span>
            </div>
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

        {/* Raise New PO Form */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-10 mb-10">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3"><Plus className="w-7 h-7 text-[#00b4d8]" /> Raise New Purchase Order</h2>

          {/* Supplier Search with Filters */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Supplier</label>
              <span className="text-xs text-neutral-500">Search + Filter</span>
            </div>

            <div className="relative mb-3">
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => handleSupplierSearchChange(e.target.value)}
                onFocus={() => setShowSupplierResults(true)}
                className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] pr-12"
                placeholder="Search supplier by trading name..."
              />
              {selectedSupplier && (
                <button onClick={clearSelectedSupplier} className="absolute right-4 top-4 text-neutral-400 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
              {searchingSuppliers && <Search className="absolute right-4 top-4 w-5 h-5 text-neutral-400 animate-pulse" />}
            </div>

            {/* Live Filters */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3 px-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={filters.verifiedOnly} onChange={(e) => setFilters(prev => ({ ...prev, verifiedOnly: e.target.checked }))} className="w-4 h-4 accent-[#00b4d8] cursor-pointer" />
                <span className="text-neutral-700">Verified Suppliers Only</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={filters.hasWallet} onChange={(e) => setFilters(prev => ({ ...prev, hasWallet: e.target.checked }))} className="w-4 h-4 accent-[#00b4d8] cursor-pointer" />
                <span className="text-neutral-700">Has Wallet Connected</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={filters.activeOnly} onChange={(e) => setFilters(prev => ({ ...prev, activeOnly: e.target.checked }))} className="w-4 h-4 accent-[#00b4d8] cursor-pointer" />
                <span className="text-neutral-700">Active / Approved Only</span>
              </label>
            </div>

            {/* Selected Supplier */}
            {selectedSupplier && (
              <div className="mt-2 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-emerald-800">{selectedSupplier.trading_name || selectedSupplier.legal_name}</div>
                  <div className="text-xs text-emerald-600">Supplier ID: {selectedSupplier.id}</div>
                </div>
                <button onClick={clearSelectedSupplier} className="text-emerald-600 hover:text-emerald-800 text-sm font-medium">Change</button>
              </div>
            )}

            {/* Search Results */}
            {showSupplierResults && supplierResults.length > 0 && (
              <div className="mt-2 border border-neutral-200 rounded-2xl shadow-xl bg-white max-h-72 overflow-auto divide-y">
                {supplierResults.map((supplier) => (
                  <button key={supplier.id} onClick={() => selectSupplier(supplier)} className="w-full text-left px-6 py-4 hover:bg-neutral-50 transition-colors flex items-center justify-between group">
                    <div>
                      <div className="font-medium text-lg group-hover:text-[#00b4d8] transition-colors">{supplier.trading_name || supplier.legal_name}</div>
                      {supplier.legal_name && supplier.trading_name && <div className="text-sm text-neutral-500">{supplier.legal_name}</div>}
                    </div>
                    <div className="text-xs px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">Select</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Wallet */}
          <div className="mb-8">
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Supplier Wallet Address <span className="text-neutral-400">(optional)</span>
            </label>
            <input type="text" value={supplierWallet} onChange={(e) => setSupplierWallet(e.target.value)} className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] font-mono" placeholder="0x... (leave blank for Standard PO)" />
            <p className="text-xs text-neutral-500 mt-1">Leave blank to create a Standard PO. You can add onchain escrow later.</p>
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
            <button onClick={handleRaisePO} disabled={loading || isContractPending || !selectedSupplier} className="px-10 py-4 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {loading || isContractPending ? 'Creating...' : supplierWallet ? 'Raise PO + Create Onchain Escrow' : 'Raise Standard Purchase Order'}
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
              {purchaseOrders.map((po) => {
                const isOnchain = !!po.onchain_po_id;
                return (
                  <div key={po.id} className="border border-neutral-200 rounded-2xl p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-xl">PO #{po.id} • Supplier {po.supplier_id}</div>
                        <div className="text-neutral-600 mt-1">{po.description}</div>
                        {isOnchain ? (
                          <div className="text-xs text-emerald-600 mt-1 font-medium">Onchain Escrow ID: {po.onchain_po_id}</div>
                        ) : (
                          <div className="text-xs text-amber-600 mt-1 font-medium">Standard PO (no onchain escrow yet)</div>
                        )}
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

                      {isOnchain && po.status !== 'paid' && po.status !== 'completed' && (
                        <button onClick={() => fundOnchainPO(po.onchain_po_id!, po.total_amount)} disabled={loading || isContractPending} className="px-5 py-2 bg-[#00b4d8] text-white rounded-2xl text-sm font-medium flex items-center gap-2 hover:bg-[#0099b8] disabled:bg-neutral-300">
                          <Wallet className="w-4 h-4" /> Fund Onchain Escrow
                        </button>
                      )}

                      {!isOnchain && (
                        <button onClick={() => createOnchainEscrow(po)} disabled={loading || isContractPending} className="px-5 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-medium flex items-center gap-2 hover:bg-emerald-700 disabled:bg-neutral-300">
                          <Wallet className="w-4 h-4" /> Create Onchain Escrow
                        </button>
                      )}

                      {po.onchain_tx && <span className="px-4 py-2 text-xs bg-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Onchain verified</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}