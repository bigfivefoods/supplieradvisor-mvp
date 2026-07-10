'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { parseEther, parseEventLogs } from 'viem';
import {
  Plus,
  Trash2,
  FileText,
  X,
  Loader2,
  Wallet,
  CheckCircle,
  Package,
  Truck,
  Shield,
  Clock,
  Star,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  isSupplierPoEscrowEnabled,
  poStatusBadgeClass,
  type PoLineItem,
} from '@/lib/procurement/types';
import { CONTRACTS } from '@/lib/contracts/config';
import POEscrowV2ABI from '@/lib/contracts/abi/POEscrowV2.json';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import FxRateStrip from '@/components/fx/FxRateStrip';
import { COMMON_CURRENCIES } from '@/lib/inventory/types';

const PO_ESCROW_ADDRESS = CONTRACTS.POEscrowV2.address;
/** Demo ZAR→ETH rate for fundPO msg.value — replace with oracle in production */
const ETH_RATE_ZAR = 55000;

type EscrowLinkKind = 'create' | 'fund' | 'release';

type PendingEscrowLink = {
  supabasePoId: number;
  txHash: `0x${string}`;
  supplierWallet: string | null;
  onchainPoId: string | number | null;
  kind: EscrowLinkKind;
};

type BookSupplier = {
  id: number;
  trading_name: string;
  linked_profile_id?: number | null;
  wallet_address?: string | null;
  invite_status?: string | null;
  status?: string | null;
  verified?: boolean | null;
  otifef_pct?: number | null;
};

type PurchaseOrder = {
  id: number;
  buyer_profile_id: number;
  supplier_id?: number | null;
  supplier_profile_id?: number | null;
  supplier_name?: string | null;
  total_amount?: number | null;
  status: string;
  description?: string | null;
  items?: PoLineItem[] | null;
  currency?: string | null;
  promised_date?: string | null;
  actual_delivery_date?: string | null;
  order_quantity?: number | null;
  delivered_quantity?: number | null;
  damaged_quantity?: number | null;
  payment_terms?: string | null;
  onchain_tx?: string | null;
  onchain_po_id?: string | number | null;
  supplier_wallet?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

export default function SupplierPurchaseOrdersPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <PoInner />
      </Suspense>
    </CompanyRequired>
  );
}

function PoInner() {
  const { user } = usePrivy();
  const searchParams = useSearchParams();
  const companyId = getSelectedCompanyId()!;
  const privyUserId = getCanonicalUserId(user?.id);
  const preselectSupplierId = Number(searchParams.get('supplierId') || 0) || null;
  const escrowEnabled = isSupplierPoEscrowEnabled();

  const { address: connectedWallet } = useAccount();
  const publicClient = usePublicClient();
  const {
    writeContract,
    data: txHash,
    isPending: isContractPending,
    error: writeError,
    isError: isWriteError,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const pendingSubmitRef = useRef<{
    supabasePoId: number;
    supplierWallet: string | null;
    onchainPoId: string | number | null;
    kind: EscrowLinkKind;
  } | null>(null);
  const autoLinkDoneForHashRef = useRef<string | null>(null);
  const writeErrorToastedRef = useRef<string | null>(null);

  const [tab, setTab] = useState<'create' | 'pipeline' | 'guide'>('create');
  const [filter, setFilter] = useState<'all' | 'open' | 'completed' | 'onchain'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingEscrowLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<BookSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    open: 0,
    completed: 0,
    onchain: 0,
    draft: 0,
    cancelled: 0,
  });

  const [selectedSrmId, setSelectedSrmId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [poCurrency, setPoCurrency] = useState('ZAR');
  const [useEscrow, setUseEscrow] = useState(false);
  const [supplierWallet, setSupplierWallet] = useState('');
  const [lineItems, setLineItems] = useState<PoLineItem[]>([
    { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' },
  ]);
  const [priceList, setPriceList] = useState<
    Array<{
      id?: number;
      product_name: string;
      sku?: string | null;
      list_price: number;
      uom?: string | null;
      seller_product_id?: number | null;
      currency?: string | null;
    }>
  >([]);

  const [deliveryPo, setDeliveryPo] = useState<PurchaseOrder | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    actual_delivery_date: new Date().toISOString().slice(0, 10),
    delivered_quantity: 0,
    damaged_quantity: 0,
    promised_date: '',
  });
  const [busyId, setBusyId] = useState<number | null>(null);

  const totalAmount = useMemo(
    () => lineItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0),
    [lineItems]
  );

  const selectedSupplier = suppliers.find((s) => s.id === selectedSrmId) || null;

  // Load active list prices when a linked supplier is selected
  useEffect(() => {
    const sellerId = selectedSupplier?.linked_profile_id
      ? Number(selectedSupplier.linked_profile_id)
      : null;
    if (!sellerId || !companyId) {
      setPriceList([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/pricing/lookup?companyId=${companyId}&sellerProfileId=${sellerId}&catalogue=1`
        );
        const data = await res.json();
        if (!cancelled) setPriceList(data.lines || []);
      } catch {
        if (!cancelled) setPriceList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSupplier?.linked_profile_id, companyId]);

  const applyPriceListLine = (line: {
    product_name: string;
    sku?: string | null;
    list_price: number;
    uom?: string | null;
    seller_product_id?: number | null;
  }) => {
    setLineItems((prev) => {
      const emptyIdx = prev.findIndex((i) => !i.item_name && !i.unit_price);
      const row: PoLineItem = {
        product_id: line.seller_product_id ? Number(line.seller_product_id) : null,
        item_name: line.product_name,
        quantity: 1,
        unit_price: Number(line.list_price) || 0,
        uom: line.uom || 'ea',
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = row;
        return next;
      }
      return [...prev, row];
    });
    toast.success(`Added ${line.product_name} at list price`);
  };

  const load = useCallback(async () => {
    if (!privyUserId) {
      // Wait for Privy session — do not leave loading stuck forever
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bookRes, poRes] = await Promise.all([
        fetch(`/api/suppliers?companyId=${companyId}`),
        fetch(
          `/api/suppliers/purchase-orders?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`
        ),
      ]);
      const book = await bookRes.json();
      const pos = await poRes.json();
      const list = (book.suppliers || []) as BookSupplier[];
      // Prefer suppliers that can receive POs (linked platform profile)
      const filtered = list.filter(
        (s) =>
          s.linked_profile_id ||
          s.invite_status === 'accepted' ||
          s.status === 'active' ||
          s.status === 'preferred'
      );
      setSuppliers(filtered);
      // Preselect from ?supplierId= (network Raise PO)
      if (preselectSupplierId && filtered.some((s) => s.id === preselectSupplierId)) {
        setSelectedSrmId(preselectSupplierId);
        setTab('create');
      }
      if (!poRes.ok) toast.error(pos.error || 'Failed to load POs');
      setPurchaseOrders(pos.purchaseOrders || []);
      setCounts(pos.counts || counts);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, preselectSupplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedSupplier?.wallet_address) {
      setSupplierWallet(selectedSupplier.wallet_address);
    }
  }, [selectedSupplier?.id, selectedSupplier?.wallet_address]);

  // Surface writeContract errors
  useEffect(() => {
    if (!isWriteError || !writeError) return;
    const msg = writeError.message || 'Wallet transaction failed';
    if (writeErrorToastedRef.current === msg) return;
    writeErrorToastedRef.current = msg;
    toast.error(msg);
  }, [isWriteError, writeError]);

  const amountInEth = (zar: number) => (zar / ETH_RATE_ZAR).toFixed(6);

  const persistEscrowLink = useCallback(
    async (link: PendingEscrowLink) => {
      if (!privyUserId) {
        setLinkError('Sign in required');
        setPendingLink(link);
        return;
      }
      if (!publicClient) {
        setLinkError('Wallet public client not ready — retry in a moment');
        setPendingLink(link);
        return;
      }

      setLinking(true);
      setLinkError(null);
      setPendingLink(link);

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: link.txHash });
        let poIdOnChain: number | string | null = null;

        if (link.kind === 'create') {
          const parsedLogs = parseEventLogs({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: POEscrowV2ABI.abi as any,
            eventName: 'PO_Created',
            logs: receipt.logs,
          });
          if (parsedLogs.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const eventArgs = (parsedLogs[0] as any).args;
            const parsed = Number(eventArgs?.poId ?? eventArgs?.[0]);
            if (Number.isFinite(parsed) && parsed > 0) poIdOnChain = parsed;
          }
        }

        // After event parse, poIdOnChain is number | null only
        if (poIdOnChain == null && link.onchainPoId != null && link.onchainPoId !== '') {
          poIdOnChain = link.onchainPoId;
        }

        if (poIdOnChain == null || !/^[1-9]\d*$/.test(String(poIdOnChain))) {
          throw new Error(
            link.kind === 'create'
              ? 'Could not parse on-chain PO id from receipt (PO_Created). Use Retry after confirm.'
              : 'Missing on-chain PO id for fund/release.'
          );
        }

        const res = await fetch(`/api/suppliers/purchase-orders/${link.supabasePoId}/onchain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            onchain_tx: link.txHash,
            onchain_po_id: poIdOnChain,
            supplier_wallet: link.supplierWallet || undefined,
            kind: link.kind,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to save on-chain refs');

        toast.success(
          link.kind === 'create'
            ? `Escrow created & linked (chain PO #${poIdOnChain})`
            : link.kind === 'fund'
              ? `Escrow funded (chain PO #${poIdOnChain})`
              : `Funds released (chain PO #${poIdOnChain})`
        );
        setPendingLink(null);
        setLinkError(null);
        pendingSubmitRef.current = null;
        resetWrite();
        await load();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to link on-chain PO';
        setLinkError(msg);
        setPendingLink(link);
        toast.error(msg);
      } finally {
        setLinking(false);
      }
    },
    [companyId, privyUserId, publicClient, load, resetWrite]
  );

  useEffect(() => {
    if (!isConfirmed || !txHash) return;
    if (autoLinkDoneForHashRef.current === txHash) return;
    const submit = pendingSubmitRef.current;
    if (!submit) return;
    autoLinkDoneForHashRef.current = txHash;
    void persistEscrowLink({
      supabasePoId: submit.supabasePoId,
      txHash,
      supplierWallet: submit.supplierWallet,
      onchainPoId: submit.onchainPoId,
      kind: submit.kind,
    });
  }, [isConfirmed, txHash, persistEscrowLink]);

  const submitCreateOnchain = (supabasePoId: number, wallet: string, amountZar: number) => {
    const eth = amountInEth(amountZar);
    const metadataURI = `https://supplieradvisor.com/po/${supabasePoId}`;
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    writeErrorToastedRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId,
      supplierWallet: wallet,
      onchainPoId: null,
      kind: 'create',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'createPO',
        args: [wallet as `0x${string}`, parseEther(eth), metadataURI],
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          autoLinkDoneForHashRef.current = null;
          toast.error(
            `createPO failed: ${err?.message || 'rejected'}. Off-chain PO #${supabasePoId} remains — create escrow later.`
          );
        },
      }
    );
  };

  const submitFundOnchain = (po: PurchaseOrder) => {
    if (!po.onchain_po_id) {
      toast.error('Create escrow first');
      return;
    }
    if (!connectedWallet) {
      toast.error('Connect wallet to fund escrow');
      return;
    }
    const eth = amountInEth(Number(po.total_amount || 0));
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId: po.id,
      supplierWallet: po.supplier_wallet || null,
      onchainPoId: po.onchain_po_id,
      kind: 'fund',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'fundPO',
        args: [BigInt(String(po.onchain_po_id))],
        value: parseEther(eth),
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          toast.error(`fundPO failed: ${err?.message || 'rejected'}`);
        },
      }
    );
  };

  const submitReleaseOnchain = (po: PurchaseOrder) => {
    if (!po.onchain_po_id) {
      toast.error('No on-chain PO to release');
      return;
    }
    if (!connectedWallet) {
      toast.error('Connect wallet to release funds');
      return;
    }
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId: po.id,
      supplierWallet: po.supplier_wallet || null,
      onchainPoId: po.onchain_po_id,
      kind: 'release',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'releaseFunds',
        args: [BigInt(String(po.onchain_po_id))],
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          toast.error(`releaseFunds failed: ${err?.message || 'rejected'}`);
        },
      }
    );
  };

  const handleRaisePO = async (asDraft = false) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (!selectedSrmId || !selectedSupplier) {
      toast.error('Select a supplier from your network');
      return;
    }
    if (!selectedSupplier.linked_profile_id) {
      toast.error('Supplier must be connected on-platform. Invite them first.');
      return;
    }
    const validItems = lineItems.filter((i) => i.item_name.trim());
    if (!validItems.length) {
      toast.error('Add at least one line item');
      return;
    }
    const wantEscrow = escrowEnabled && useEscrow && !asDraft;
    if (wantEscrow) {
      if (!connectedWallet) {
        toast.error('Connect wallet for on-chain escrow');
        return;
      }
      if (!supplierWallet || !/^0x[a-fA-F0-9]{40}$/.test(supplierWallet)) {
        toast.error('Valid supplier wallet (0x…) required for escrow');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/suppliers/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          srmSupplierId: selectedSrmId,
          supplierProfileId: selectedSupplier.linked_profile_id,
          items: validItems,
          description,
          promised_date: promisedDate || null,
          payment_terms: paymentTerms || null,
          currency: poCurrency || 'ZAR',
          useEscrow: wantEscrow,
          supplier_wallet: supplierWallet || null,
          status: asDraft ? 'draft' : 'sent',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PO');

      const po = data.purchaseOrder as PurchaseOrder;
      toast.success(
        asDraft
          ? `Draft PO #${po.id} saved`
          : wantEscrow
            ? `PO #${po.id} created — confirm escrow in wallet…`
            : `Standard PO #${po.id} sent`
      );

      if (wantEscrow && supplierWallet) {
        submitCreateOnchain(po.id, supplierWallet, Number(po.total_amount || totalAmount));
      }

      setDescription('');
      setPromisedDate('');
      setLineItems([{ product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' }]);
      setUseEscrow(false);
      setTab('pipeline');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const patchPo = async (id: number, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/suppliers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(body.status ? `PO → ${body.status}` : 'PO updated');
      await load();
      return data.purchaseOrder as PurchaseOrder;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const openDelivery = (po: PurchaseOrder) => {
    const orderQty =
      Number(po.order_quantity) ||
      (po.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
    setDeliveryForm({
      actual_delivery_date: new Date().toISOString().slice(0, 10),
      delivered_quantity: orderQty,
      damaged_quantity: 0,
      promised_date: po.promised_date || '',
    });
    setDeliveryPo(po);
  };

  const submitDelivery = async () => {
    if (!deliveryPo) return;
    const updated = await patchPo(deliveryPo.id, {
      status: 'completed',
      actual_delivery_date: deliveryForm.actual_delivery_date,
      delivered_quantity: deliveryForm.delivered_quantity,
      damaged_quantity: deliveryForm.damaged_quantity,
      promised_date: deliveryForm.promised_date || deliveryPo.promised_date,
      order_quantity:
        Number(deliveryPo.order_quantity) ||
        (deliveryPo.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
    });
    if (updated) {
      setDeliveryPo(null);
      toast.message('OTIFEF inputs saved — view Performance for scorecards');
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'open') {
      return purchaseOrders.filter((p) =>
        ['draft', 'sent', 'accepted', 'funded'].includes(String(p.status))
      );
    }
    if (filter === 'completed') {
      return purchaseOrders.filter((p) => ['completed', 'paid'].includes(String(p.status)));
    }
    if (filter === 'onchain') {
      return purchaseOrders.filter((p) => p.onchain_po_id != null && p.onchain_po_id !== '');
    }
    return purchaseOrders;
  }, [purchaseOrders, filter]);

  const sepoliaTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Purchase orders"
        description="World-class procurement: standard off-chain POs with full OTIFEF delivery capture, or optional POEscrowV2 on-chain escrow (create → fund → release) with client-signed wallet txs."
        action={
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800">
              <FileText className="w-3 h-3" /> Standard
            </span>
            {escrowEnabled && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full bg-[#00b4d8]/15 text-[#0077b6]">
                <Shield className="w-3 h-3" /> On-chain escrow
              </span>
            )}
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[
          { k: 'total', label: 'All POs', n: counts.total },
          { k: 'open', label: 'Open', n: counts.open },
          { k: 'completed', label: 'Completed', n: counts.completed },
          { k: 'onchain', label: 'On-chain', n: counts.onchain },
          { k: 'draft', label: 'Drafts', n: counts.draft },
          { k: 'cancelled', label: 'Cancelled', n: counts.cancelled },
        ].map((c) => (
          <div key={c.k} className="bg-white border rounded-2xl px-3 py-3">
            <div className="text-2xl font-black tracking-tight">{c.n}</div>
            <div className="text-[11px] text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-neutral-100 rounded-2xl mb-6 w-fit">
        {(
          [
            ['create', 'Raise PO'],
            ['pipeline', 'Pipeline'],
            ['guide', 'Process guide'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              tab === k ? 'bg-white shadow text-slate-900' : 'text-neutral-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(isContractPending || isConfirming || linking) && (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isContractPending
            ? 'Confirm transaction in your wallet…'
            : isConfirming
              ? 'Waiting for chain confirmation…'
              : 'Linking on-chain refs…'}
        </div>
      )}

      {pendingLink && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <div className="font-semibold text-amber-900 mb-1">
            Escrow tx needs linking for PO #{pendingLink.supabasePoId}
          </div>
          {linkError && <p className="text-amber-800 text-xs mb-2">{linkError}</p>}
          <button
            type="button"
            disabled={linking}
            onClick={() => void persistEscrowLink(pendingLink)}
            className="btn-secondary !py-1.5 !px-3 text-xs"
          >
            Retry link
          </button>
        </div>
      )}

      {tab === 'guide' && <ProcessGuide escrowEnabled={escrowEnabled} />}

      {tab === 'create' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white border rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#00b4d8]" /> New purchase order
            </h2>

            <div>
              <label className="text-xs font-medium">Supplier (from your network) *</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={selectedSrmId ?? ''}
                onChange={(e) =>
                  setSelectedSrmId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.linked_profile_id}>
                    {s.trading_name}
                    {!s.linked_profile_id
                      ? ' (invite pending — not linked yet)'
                      : s.verified
                        ? ' ✓'
                        : ''}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="text-xs text-neutral-500 mt-1">
                  No linked suppliers yet.{' '}
                  <Link href="/dashboard/suppliers/discover" className="text-[#00b4d8] underline">
                    Discover
                  </Link>{' '}
                  or{' '}
                  <Link href="/dashboard/suppliers/add" className="text-[#00b4d8] underline">
                    invite
                  </Link>
                  .
                </p>
              )}
              {selectedSupplier?.linked_profile_id && priceList.length > 0 && (
                <div className="mt-3 p-3 rounded-2xl border border-[#00b4d8]/20 bg-[#00b4d8]/5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0077b6] mb-2">
                    Agreed list prices ({priceList.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {priceList.map((l) => (
                      <button
                        key={l.id || `${l.sku}-${l.product_name}`}
                        type="button"
                        onClick={() => applyPriceListLine(l)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00b4d8]/30 bg-white text-slate-700 hover:bg-[#00b4d8]/10"
                        title="Add line at list price"
                      >
                        {l.product_name}
                        <span className="text-neutral-400 font-normal ml-1">
                          @ {Number(l.list_price).toFixed(2)}{' '}
                          {l.currency || poCurrency}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    From active pricing agreements ·{' '}
                    <Link href="/dashboard/connections/pricing" className="text-[#00b4d8] underline">
                      manage
                    </Link>
                  </p>
                </div>
              )}
              {selectedSupplier?.linked_profile_id && priceList.length === 0 && (
                <p className="text-[11px] text-neutral-500 mt-2">
                  No active price list with this supplier yet.{' '}
                  <Link href="/dashboard/connections/pricing" className="text-[#00b4d8] underline">
                    Create or import pricing
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Promised delivery date</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Required for On-Time OTIFEF
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Payment terms</label>
                <input
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">PO currency *</label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm font-semibold"
                  value={poCurrency}
                  onChange={(e) => setPoCurrency(e.target.value)}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <FxRateStrip currency={poCurrency} />

            <div>
              <label className="text-xs font-medium">Description / notes</label>
              <textarea
                className="input mt-1 w-full !p-3 !text-sm min-h-[70px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Delivery instructions, reference numbers…"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium">Line items *</label>
                <button
                  type="button"
                  onClick={() =>
                    setLineItems([
                      ...lineItems,
                      { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' },
                    ])
                  }
                  className="text-xs font-semibold text-[#00b4d8]"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-start border rounded-2xl p-2 bg-neutral-50/50"
                  >
                    <input
                      className="input !p-2 !text-sm col-span-12 sm:col-span-5"
                      placeholder="Item name"
                      value={item.item_name}
                      onChange={(e) => {
                        const u = [...lineItems];
                        u[idx] = { ...u[idx], item_name: e.target.value };
                        setLineItems(u);
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      className="input !p-2 !text-sm col-span-4 sm:col-span-2"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const u = [...lineItems];
                        u[idx] = { ...u[idx], quantity: Number(e.target.value) };
                        setLineItems(u);
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input !p-2 !text-sm col-span-4 sm:col-span-2"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => {
                        const u = [...lineItems];
                        u[idx] = { ...u[idx], unit_price: Number(e.target.value) };
                        setLineItems(u);
                      }}
                    />
                    <input
                      className="input !p-2 !text-sm col-span-3 sm:col-span-2"
                      placeholder="UoM"
                      value={item.uom || ''}
                      onChange={(e) => {
                        const u = [...lineItems];
                        u[idx] = { ...u[idx], uom: e.target.value };
                        setLineItems(u);
                      }}
                    />
                    <button
                      type="button"
                      className="col-span-1 p-2 text-red-500"
                      onClick={() =>
                        lineItems.length > 1 &&
                        setLineItems(lineItems.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {escrowEnabled && (
              <div className="rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={useEscrow}
                    onChange={(e) => setUseEscrow(e.target.checked)}
                  />
                  <div>
                    <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#00b4d8]" /> Create on-chain escrow (POEscrowV2)
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Client-signed createPO after the off-chain PO is saved. Funds later via fundPO;
                      release after delivery. Demo rate ≈ R{ETH_RATE_ZAR.toLocaleString()} / ETH.
                    </p>
                  </div>
                </label>
                {useEscrow && (
                  <div>
                    <label className="text-xs font-medium">Supplier wallet *</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm font-mono"
                      placeholder="0x…"
                      value={supplierWallet}
                      onChange={(e) => setSupplierWallet(e.target.value)}
                    />
                    {connectedWallet ? (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Buyer wallet connected: {connectedWallet.slice(0, 6)}…{connectedWallet.slice(-4)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 mt-1">Connect wallet to sign escrow</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <button
                type="button"
                disabled={saving || isContractPending}
                onClick={() => void handleRaisePO(false)}
                className="btn-primary !py-3 !px-6 text-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : useEscrow ? (
                  <>
                    <Shield className="w-4 h-4" /> Send PO + create escrow
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" /> Send standard PO
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleRaisePO(true)}
                className="btn-secondary !py-3 !px-5 text-sm"
              >
                Save draft
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#00b4d8]/25 rounded-3xl p-6 bg-gradient-to-br from-white to-[#00b4d8]/[0.06]">
              <div className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">
                Order total
              </div>
              <div className="text-4xl font-black tracking-tighter mt-1 text-slate-800">
                {poCurrency}{' '}
                {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {useEscrow && (
                <div className="text-sm text-[#0077b6] mt-2 font-medium">
                  ≈ {amountInEth(totalAmount)} ETH escrow
                </div>
              )}
              <div className="mt-4 text-xs text-neutral-500 space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Off-chain audit trail
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#00b4d8]" /> OTIFEF on delivery
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Rate after complete
                </div>
              </div>
            </div>
            <div className="bg-white border rounded-3xl p-5 text-sm text-neutral-600">
              <h3 className="font-bold text-slate-900 mb-2">Lifecycle</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li>Raise draft or send PO</li>
                <li>Optional: create & fund on-chain escrow</li>
                <li>Accept → track delivery</li>
                <li>Record delivery (feeds OTIFEF)</li>
                <li>Release escrow / mark complete</li>
                <li>
                  <Link href="/dashboard/suppliers/ratings" className="text-[#00b4d8] underline">
                    Rate supplier
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                ['all', 'All'],
                ['open', 'Open'],
                ['completed', 'Completed'],
                ['onchain', 'On-chain'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  filter === k
                    ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                    : 'bg-white border-neutral-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white border rounded-3xl overflow-hidden">
            {loading ? (
              <div className="p-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-sm text-neutral-500">
                No purchase orders in this view.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((po) => {
                  const onchain = po.onchain_po_id != null && po.onchain_po_id !== '';
                  const busy = busyId === po.id;
                  return (
                    <li key={po.id} className="px-4 sm:px-6 py-5">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">PO #{po.id}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${poStatusBadgeClass(po.status)}`}
                            >
                              {po.status}
                            </span>
                            {onchain ? (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#00b4d8]/15 text-[#0077b6]">
                                Escrow #{po.onchain_po_id}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                                Standard
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {po.supplier_name || `Supplier #${po.supplier_profile_id || po.supplier_id}`}
                            {' · '}
                            <span className="font-semibold text-slate-900">
                              R{Number(po.total_amount || 0).toLocaleString()}
                            </span>
                            {po.promised_date ? ` · promised ${po.promised_date}` : ''}
                          </div>
                          {po.description && (
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                              {po.description}
                            </p>
                          )}
                          {po.onchain_tx && (
                            <a
                              href={sepoliaTx(String(po.onchain_tx))}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#00b4d8] mt-1"
                            >
                              View create tx <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {po.actual_delivery_date && (
                            <div className="text-[11px] text-emerald-700 mt-1">
                              Delivered {po.actual_delivery_date}
                              {po.delivered_quantity != null
                                ? ` · qty ${po.delivered_quantity}/${po.order_quantity ?? '—'}`
                                : ''}
                              {po.damaged_quantity
                                ? ` · damaged ${po.damaged_quantity}`
                                : ''}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {po.status === 'draft' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchPo(po.id, { status: 'sent' })}
                              className="btn-primary !py-1.5 !px-3 text-xs"
                            >
                              Send
                            </button>
                          )}
                          {po.status === 'sent' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchPo(po.id, { status: 'accepted' })}
                              className="btn-secondary !py-1.5 !px-3 text-xs"
                            >
                              Mark accepted
                            </button>
                          )}
                          {escrowEnabled &&
                            !onchain &&
                            ['sent', 'accepted', 'draft'].includes(String(po.status)) && (
                              <button
                                type="button"
                                disabled={isContractPending || !po.supplier_wallet}
                                onClick={() => {
                                  if (!po.supplier_wallet) {
                                    toast.error('Set supplier wallet first');
                                    return;
                                  }
                                  if (!connectedWallet) {
                                    toast.error('Connect wallet');
                                    return;
                                  }
                                  submitCreateOnchain(
                                    po.id,
                                    String(po.supplier_wallet),
                                    Number(po.total_amount || 0)
                                  );
                                }}
                                className="btn-secondary !py-1.5 !px-3 text-xs"
                              >
                                <Shield className="w-3 h-3" /> Create escrow
                              </button>
                            )}
                          {escrowEnabled &&
                            onchain &&
                            po.status !== 'funded' &&
                            po.status !== 'completed' &&
                            po.status !== 'cancelled' && (
                              <button
                                type="button"
                                disabled={isContractPending}
                                onClick={() => submitFundOnchain(po)}
                                className="btn-primary !py-1.5 !px-3 text-xs"
                              >
                                <Wallet className="w-3 h-3" /> Fund escrow
                              </button>
                            )}
                          {['accepted', 'funded', 'sent'].includes(String(po.status)) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openDelivery(po)}
                              className="btn-secondary !py-1.5 !px-3 text-xs"
                            >
                              <Package className="w-3 h-3" /> Record delivery
                            </button>
                          )}
                          {escrowEnabled &&
                            onchain &&
                            (po.status === 'funded' || po.status === 'completed') && (
                              <button
                                type="button"
                                disabled={isContractPending}
                                onClick={() => submitReleaseOnchain(po)}
                                className="btn-secondary !py-1.5 !px-3 text-xs"
                              >
                                Release funds
                              </button>
                            )}
                          {po.status === 'completed' && (
                            <Link
                              href="/dashboard/suppliers/ratings"
                              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                            >
                              <Star className="w-3 h-3" /> Rate
                            </Link>
                          )}
                          {['draft', 'sent', 'accepted'].includes(String(po.status)) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchPo(po.id, { status: 'cancelled' })}
                              className="text-xs text-red-600 px-2"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Delivery / OTIFEF modal */}
      {deliveryPo && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Record delivery · PO #{deliveryPo.id}</h3>
              <button type="button" onClick={() => setDeliveryPo(null)} className="p-2 rounded-xl hover:bg-neutral-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              These fields drive OTIFEF: On-Time (actual ≤ promised), In-Full (delivered / ordered),
              Error-Free (undamaged / delivered).
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Promised date</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={deliveryForm.promised_date}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, promised_date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium">Actual delivery date *</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={deliveryForm.actual_delivery_date}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, actual_delivery_date: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Delivered qty</label>
                  <input
                    type="number"
                    min={0}
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={deliveryForm.delivered_quantity}
                    onChange={(e) =>
                      setDeliveryForm({
                        ...deliveryForm,
                        delivered_quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Damaged qty</label>
                  <input
                    type="number"
                    min={0}
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={deliveryForm.damaged_quantity}
                    onChange={(e) =>
                      setDeliveryForm({
                        ...deliveryForm,
                        damaged_quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeliveryPo(null)}
                className="btn-secondary flex-1 !py-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitDelivery()}
                className="btn-primary flex-1 !py-3"
              >
                Complete + save OTIFEF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SuppliersPage>
  );
}

function ProcessGuide({ escrowEnabled }: { escrowEnabled: boolean }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white border rounded-3xl p-6">
        <div className="inline-flex p-2 rounded-xl bg-emerald-100 text-emerald-800 mb-3">
          <FileText className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-2">Standard PO process</h3>
        <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside">
          <li>Select a connected supplier from your book</li>
          <li>Add line items, promised date, payment terms</li>
          <li>Send (or save draft) — status machine enforced server-side</li>
          <li>Mark accepted when supplier confirms</li>
          <li>Record delivery quantities → feeds OTIFEF scorecards</li>
          <li>Rate supplier quality / delivery / communication / value</li>
        </ol>
      </div>
      <div className="bg-white border rounded-3xl p-6">
        <div className="inline-flex p-2 rounded-xl bg-[#00b4d8]/15 text-[#0077b6] mb-3">
          <Shield className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-2">On-chain escrow (POEscrowV2)</h3>
        {escrowEnabled ? (
          <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside">
            <li>Create off-chain PO first (source of truth)</li>
            <li>
              <code className="text-xs bg-neutral-100 px-1 rounded">createPO</code> — client-signed;
              links chain PO id from PO_Created
            </li>
            <li>
              <code className="text-xs bg-neutral-100 px-1 rounded">fundPO</code> — lock ETH (demo
              ZAR rate); status → funded
            </li>
            <li>Record delivery / complete off-chain</li>
            <li>
              <code className="text-xs bg-neutral-100 px-1 rounded">releaseFunds</code> — pay
              supplier after performance
            </li>
            <li>All txs audited in activity log + PO metadata</li>
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">
            Escrow disabled via SUPPLIER_PO_ESCROW_ENABLED.
          </p>
        )}
        <p className="text-xs text-neutral-500 mt-4">
          Contract: {PO_ESCROW_ADDRESS.slice(0, 10)}… on Sepolia · never uses server private key
        </p>
      </div>
    </div>
  );
}
