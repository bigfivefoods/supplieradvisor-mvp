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
  fiatToEthString,
  getEthDemoRateFiat,
  getPoEscrowAddress,
  escrowTxUrl,
  ESCROW_LIFECYCLE,
  type EscrowLinkKind,
} from '@/lib/contracts/escrow';
import WalletConnectBar from '@/components/onchain/WalletConnectBar';
import UsdcEscrowActions from '@/components/onchain/UsdcEscrowActions';
import { isUsdcEscrowEnabled } from '@/lib/contracts/usdcEscrow';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import FxRateStrip from '@/components/fx/FxRateStrip';
import { COMMON_CURRENCIES } from '@/lib/inventory/types';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  finished_good: 'Finished goods',
  raw_material: 'Raw materials',
  component: 'Components',
  packaging: 'Packaging',
  service: 'Services',
  other: 'Other',
};

function productTypeLabel(type: string | null | undefined): string {
  const key = String(type || 'other').toLowerCase();
  return PRODUCT_TYPE_LABELS[key] || key.replace(/_/g, ' ');
}

/** Sellable line from supplier agreement catalogue or supplier inventory */
type SupplierCatalogueItem = {
  key: string;
  source: 'agreement' | 'inventory';
  seller_product_id: number | null;
  product_name: string;
  sku: string | null;
  product_type: string | null;
  uom: string | null;
  unit_price: number;
  currency: string;
  agreement_title?: string | null;
  primary_image_url?: string | null;
};

const PO_ESCROW_ADDRESS = getPoEscrowAddress() || CONTRACTS.POEscrowV2.address;
/** Demo ZAR→ETH rate for fundPO msg.value — override via NEXT_PUBLIC_ETH_DEMO_RATE */
const ETH_RATE_ZAR = getEthDemoRateFiat();

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
  fulfilment_status?: string | null;
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
  /** Optional override for fundPO msg.value (ETH). Empty = demo fiat conversion. */
  const [escrowEthOverride, setEscrowEthOverride] = useState('');
  const usdcEnabled = isUsdcEscrowEnabled();
  /** Prefer USDC on Base for B2B demos; ETH Sepolia remains dev-only fallback */
  const [escrowAsset, setEscrowAsset] = useState<'eth' | 'usdc'>(
    usdcEnabled ? 'usdc' : 'eth'
  );
  const [lineItems, setLineItems] = useState<PoLineItem[]>([
    { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' },
  ]);
  /** Selected supplier’s sellable catalogue (agreements + their inventory) */
  const [supplierCatalogue, setSupplierCatalogue] = useState<
    SupplierCatalogueItem[]
  >([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueReadiness, setCatalogueReadiness] = useState<{
    score: number;
    level: string;
    label: string;
    tips: string[];
    sellableProducts: number;
    agreementLines: number;
  } | null>(null);
  /** Which catalogue key is bound to each line (for dropdown state) */
  const [lineCatalogueKeys, setLineCatalogueKeys] = useState<(string | null)[]>(
    [null]
  );

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

  // Load selected supplier’s catalogue (price agreements + their inventory)
  useEffect(() => {
    if (!companyId || !selectedSrmId) {
      setSupplierCatalogue([]);
      setCatalogueWarning(null);
      setCatalogueReadiness(null);
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueWarning(null);
    void (async () => {
      try {
        const qs = new URLSearchParams({
          companyId: String(companyId),
          supplierId: String(selectedSrmId),
          currency: poCurrency,
        });
        const res = await fetch(`/api/suppliers/catalogue?${qs}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSupplierCatalogue([]);
          setCatalogueWarning(
            (data as { error?: string }).error ||
              'Could not load supplier catalogue'
          );
          return;
        }
        const list = Array.isArray(
          (data as { items?: SupplierCatalogueItem[] }).items
        )
          ? (data as { items: SupplierCatalogueItem[] }).items
          : [];
        setSupplierCatalogue(list);
        setCatalogueWarning(
          (data as { warning?: string | null }).warning || null
        );
        const r = (data as { readiness?: typeof catalogueReadiness }).readiness;
        setCatalogueReadiness(r || null);

        // Once per session: soft-nudge supplier if catalogue empty but linked
        if (
          list.length === 0 &&
          selectedSupplier?.linked_profile_id &&
          typeof sessionStorage !== 'undefined'
        ) {
          const nudgeKey = `sa_cat_nudge_${companyId}_${selectedSrmId}`;
          try {
            if (!sessionStorage.getItem(nudgeKey)) {
              sessionStorage.setItem(nudgeKey, '1');
              const nudgeQs = new URLSearchParams({
                companyId: String(companyId),
                supplierId: String(selectedSrmId),
                currency: poCurrency,
                nudge: '1',
              });
              void fetch(`/api/suppliers/catalogue?${nudgeQs}`, {
                cache: 'no-store',
              });
            }
          } catch {
            /* private mode */
          }
        }
      } catch {
        if (!cancelled) {
          setSupplierCatalogue([]);
          setCatalogueWarning('Failed to load supplier catalogue');
        }
      } finally {
        if (!cancelled) setCatalogueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedSrmId, poCurrency, selectedSupplier?.linked_profile_id]);

  // Reset free lines when switching supplier (catalogue is supplier-specific)
  useEffect(() => {
    setLineItems([
      { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' },
    ]);
    setLineCatalogueKeys([null]);
    setCatalogueSearch('');
  }, [selectedSrmId]);

  // Reprice catalogue-linked lines when supplier catalogue reloads (e.g. currency)
  useEffect(() => {
    if (!supplierCatalogue.length) return;
    setLineItems((prev) => {
      let changed = false;
      const next = prev.map((row, idx) => {
        const key = lineCatalogueKeys[idx];
        if (!key) return row;
        const cat = supplierCatalogue.find((c) => c.key === key);
        if (!cat) return row;
        const price = Number(cat.unit_price) || 0;
        if (
          row.unit_price === price &&
          row.item_name === cat.product_name &&
          row.product_id === cat.seller_product_id
        ) {
          return row;
        }
        changed = true;
        return {
          ...row,
          product_id: cat.seller_product_id,
          item_name: cat.product_name,
          unit_price: price,
          uom: cat.uom || row.uom || 'ea',
          primary_image_url: cat.primary_image_url || row.primary_image_url,
        };
      });
      return changed ? next : prev;
    });
  }, [supplierCatalogue, lineCatalogueKeys]);

  const filteredCatalogue = useMemo(() => {
    const q = catalogueSearch.trim().toLowerCase();
    if (!q) return supplierCatalogue;
    return supplierCatalogue.filter((i) => {
      const hay = [
        i.product_name,
        i.sku,
        i.product_type,
        i.agreement_title,
        i.source,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [supplierCatalogue, catalogueSearch]);

  const catalogueGroups = useMemo(() => {
    const agreement = filteredCatalogue.filter((i) => i.source === 'agreement');
    const inventory = filteredCatalogue.filter((i) => i.source === 'inventory');
    const byType = new Map<string, SupplierCatalogueItem[]>();
    for (const p of inventory) {
      const key = String(p.product_type || 'other').toLowerCase() || 'other';
      const list = byType.get(key) || [];
      list.push(p);
      byType.set(key, list);
    }
    const typeOrder = [
      'finished_good',
      'service',
      'raw_material',
      'component',
      'packaging',
      'other',
    ];
    const typeKeys = [
      ...typeOrder.filter((k) => byType.has(k)),
      ...[...byType.keys()].filter((k) => !typeOrder.includes(k)).sort(),
    ];
    return {
      agreement,
      inventoryByType: typeKeys.map((k) => ({
        type: k,
        items: byType.get(k) || [],
      })),
      total: filteredCatalogue.length,
      unfilteredTotal: supplierCatalogue.length,
    };
  }, [filteredCatalogue, supplierCatalogue.length]);

  const applyCatalogueItem = (
    idx: number,
    catalogueKey: string | null
  ) => {
    if (!catalogueKey) {
      setLineItems((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          product_id: null,
          item_name: '',
          unit_price: 0,
          uom: next[idx].uom || 'ea',
          primary_image_url: null,
        };
        return next;
      });
      setLineCatalogueKeys((prev) => {
        const next = [...prev];
        while (next.length <= idx) next.push(null);
        next[idx] = null;
        return next;
      });
      return;
    }
    const item = supplierCatalogue.find((c) => c.key === catalogueKey);
    if (!item) return;
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        product_id: item.seller_product_id,
        item_name: item.product_name,
        unit_price: Number(item.unit_price) || 0,
        uom: item.uom || next[idx].uom || 'ea',
        primary_image_url: item.primary_image_url || null,
      };
      return next;
    });
    setLineCatalogueKeys((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push(null);
      next[idx] = catalogueKey;
      return next;
    });
  };

  const addCatalogueLine = (item: SupplierCatalogueItem) => {
    setLineItems((prev) => {
      const emptyIdx = prev.findIndex((i) => !i.item_name && !i.unit_price);
      const row: PoLineItem = {
        product_id: item.seller_product_id,
        item_name: item.product_name,
        quantity: 1,
        unit_price: Number(item.unit_price) || 0,
        uom: item.uom || 'ea',
        primary_image_url: item.primary_image_url || null,
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = row;
        setLineCatalogueKeys((keys) => {
          const k = [...keys];
          while (k.length <= emptyIdx) k.push(null);
          k[emptyIdx] = item.key;
          return k;
        });
        return next;
      }
      setLineCatalogueKeys((keys) => [...keys, item.key]);
      return [...prev, row];
    });
    toast.success(
      item.source === 'agreement'
        ? `Added ${item.product_name} at agreed list price`
        : `Added ${item.product_name} from supplier catalogue`
    );
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

  const amountInEth = (zar: number) => {
    const o = escrowEthOverride.trim();
    if (o && Number.isFinite(Number(o)) && Number(o) > 0) {
      return Number(o).toFixed(6);
    }
    return fiatToEthString(zar, ETH_RATE_ZAR);
  };

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
              : 'Missing on-chain PO id for fund/ship/release.'
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
              : link.kind === 'ship'
                ? `Marked shipped on-chain (PO #${poIdOnChain})`
                : `Delivery confirmed — supplier paid (chain PO #${poIdOnChain})`
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

  /** Supplier wallet must call markShipped before buyer can confirmDelivery */
  const submitShipOnchain = (po: PurchaseOrder) => {
    if (!po.onchain_po_id) {
      toast.error('No on-chain PO to mark shipped');
      return;
    }
    if (!connectedWallet) {
      toast.error('Connect the supplier wallet to mark shipped');
      return;
    }
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId: po.id,
      supplierWallet: po.supplier_wallet || connectedWallet,
      onchainPoId: po.onchain_po_id,
      kind: 'ship',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'markShipped',
        args: [BigInt(String(po.onchain_po_id))],
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          toast.error(
            `markShipped failed: ${err?.message || 'rejected'}. Must be the supplier address on-chain.`
          );
        },
      }
    );
  };

  /** Buyer confirmDelivery — releases escrowed ETH to supplier (Hardhat POEscrowV2) */
  const submitReleaseOnchain = (po: PurchaseOrder) => {
    if (!po.onchain_po_id) {
      toast.error('No on-chain PO to confirm');
      return;
    }
    if (!connectedWallet) {
      toast.error('Connect buyer wallet to confirm delivery & release');
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
        functionName: 'confirmDelivery',
        args: [BigInt(String(po.onchain_po_id))],
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          toast.error(
            `confirmDelivery failed: ${err?.message || 'rejected'}. Supplier must markShipped first.`
          );
        },
      }
    );
  };

  /**
   * Raise PO. Pass `mode: 'standard' | 'escrow'` to force path (avoids React state race).
   * Drafts are always standard off-chain records (no createPO tx).
   */
  const handleRaisePO = async (
    asDraft = false,
    opts?: { mode?: 'standard' | 'escrow' }
  ) => {
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
    const mode = opts?.mode ?? (useEscrow ? 'escrow' : 'standard');
    const wantEscrow = escrowEnabled && mode === 'escrow' && !asDraft;
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
      const { toastGoldenPathFromResponse } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathFromResponse(data);

      if (wantEscrow && supplierWallet) {
        submitCreateOnchain(po.id, supplierWallet, Number(po.total_amount || totalAmount));
      }

      setDescription('');
      setPromisedDate('');
      setLineItems([{ product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'ea' }]);
      setLineCatalogueKeys([null]);
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

  const receiveToStock = async (po: PurchaseOrder) => {
    setBusyId(po.id);
    try {
      const res = await fetch('/api/suppliers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: po.id,
          action: 'receive_inventory',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const warns = Array.isArray(data.warnings)
          ? data.warnings.slice(0, 2).join(' · ')
          : '';
        throw new Error(
          [
            (data as { error?: string }).error || 'Receive failed',
            warns,
          ]
            .filter(Boolean)
            .join(' — ')
        );
      }
      const r = data.receive as {
        receivedLines?: number;
        qtyTotal?: number;
        skippedLines?: number;
        warnings?: string[];
      };
      toast.success(
        `Received ${r?.receivedLines || 0} lines (qty ${r?.qtyTotal || 0}) into stock`,
        {
          description:
            r?.skippedLines
              ? `${r.skippedLines} line(s) skipped — match SKU or import products`
              : 'Open Inventory → Stock to verify',
        }
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Receive failed');
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

  const submitDelivery = async (opts?: { rateAfter?: boolean }) => {
    if (!deliveryPo) return;
    const rateeId =
      Number(deliveryPo.supplier_profile_id || deliveryPo.supplier_id) || null;
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
      if (opts?.rateAfter && rateeId) {
        toast.success('OTIFEF saved — rate this supplier to close the trust loop');
        window.location.href = `/dashboard/suppliers/ratings?ratee=${rateeId}`;
      } else {
        toast.message('OTIFEF inputs saved', {
          description: rateeId
            ? 'Rate the supplier to complete the trust loop'
            : 'View Performance for scorecards',
          action: rateeId
            ? {
                label: 'Rate now',
                onClick: () => {
                  window.location.href = `/dashboard/suppliers/ratings?ratee=${rateeId}`;
                },
              }
            : undefined,
        });
      }
    }
  };

  /** Buyer-facing next step for pipeline cards */
  function buyerNextStep(po: PurchaseOrder): {
    title: string;
    body: string;
    tone: 'amber' | 'sky' | 'emerald' | 'slate';
  } | null {
    const st = String(po.status || '').toLowerCase();
    if (st === 'draft') {
      return {
        title: 'Next: Send PO',
        body: 'Supplier cannot see drafts. Send when lines and promised date are ready.',
        tone: 'slate',
      };
    }
    if (st === 'sent') {
      return {
        title: 'Next: Wait for supplier accept',
        body: 'They action this under Customers → Inbound. You can still cancel if needed.',
        tone: 'amber',
      };
    }
    if (st === 'accepted') {
      return {
        title: 'Next: Await fulfilment, then record delivery',
        body: 'When goods arrive, capture OTIFEF (qty / damage / dates) and rate the supplier.',
        tone: 'sky',
      };
    }
    if (st === 'funded') {
      return {
        title: 'Next: Escrow funded — confirm ship/delivery',
        body: 'Complete on-chain ship/confirm or record off-chain delivery for OTIFEF.',
        tone: 'sky',
      };
    }
    if (st === 'completed' || st === 'paid') {
      return {
        title: 'Next: Rate supplier',
        body: 'Peer stars + OTIFEF build network trust for this trade.',
        tone: 'emerald',
      };
    }
    return null;
  }

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

  const sepoliaTx = (hash: string) => escrowTxUrl(hash);

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Purchase orders"
        description="Raise a standard off-chain PO (OTIFEF delivery + ratings) or an escrow PO (create → fund → ship → confirm on-chain). Both paths use the same supplier book and line items."
        action={
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800">
              <FileText className="w-3 h-3" /> Standard PO
            </span>
            {escrowEnabled && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full bg-[#00b4d8]/15 text-[#0077b6]">
                <Shield className="w-3 h-3" /> Escrow PO
              </span>
            )}
          </div>
        }
      />

      {escrowEnabled && (
        <div className="mb-6">
          <WalletConnectBar />
          <p className="text-[11px] text-neutral-500 mt-2">
            Wallet is only required for escrow POs. Standard POs work without a wallet.
          </p>
        </div>
      )}

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
              {selectedSupplier && (
                <div className="mt-3 p-3 rounded-2xl border border-[#00b4d8]/20 bg-[#00b4d8]/5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0077b6] mb-1">
                    Supplier catalogue
                    {catalogueLoading
                      ? ' · loading…'
                      : catalogueGroups.unfilteredTotal
                        ? ` · ${catalogueGroups.unfilteredTotal} sellable`
                        : ''}
                    {catalogueReadiness
                      ? ` · ${catalogueReadiness.label} (${catalogueReadiness.score})`
                      : ''}
                  </div>
                  {catalogueReadiness && (
                    <div className="mb-2">
                      <div className="h-1.5 rounded-full bg-white/80 overflow-hidden border border-[#00b4d8]/20">
                        <div
                          className={`h-full rounded-full transition-all ${
                            catalogueReadiness.level === 'strong'
                              ? 'bg-emerald-500'
                              : catalogueReadiness.level === 'ready'
                                ? 'bg-[#00b4d8]'
                                : catalogueReadiness.level === 'thin'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                          }`}
                          style={{
                            width: `${Math.max(4, catalogueReadiness.score)}%`,
                          }}
                        />
                      </div>
                      {catalogueReadiness.tips[0] && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          {catalogueReadiness.tips[0]}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-neutral-600 mb-2 leading-relaxed">
                    PO lines pull from this supplier’s{' '}
                    <strong>agreed price list</strong> and their published{' '}
                    <strong>inventory</strong> (finished goods, services, …) —
                    not your own stock. Prices follow PO currency when available.
                    Free-text lines remain below.
                  </p>
                  {!selectedSupplier.linked_profile_id && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2 space-y-1">
                      <p className="font-bold">Supplier not linked to the platform</p>
                      <p>
                        Invite them or accept a network connection so you can buy
                        from their catalogue. Free-text lines still work.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link
                          href="/dashboard/suppliers/invites"
                          className="font-bold text-[#00b4d8] underline"
                        >
                          Invite supplier
                        </Link>
                        <Link
                          href="/dashboard/connections"
                          className="font-bold text-slate-600 underline"
                        >
                          Network
                        </Link>
                      </div>
                    </div>
                  )}
                  {selectedSupplier.linked_profile_id &&
                    !catalogueLoading &&
                    catalogueGroups.unfilteredTotal === 0 && (
                      <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2 space-y-1">
                        <p className="font-bold">No sellable catalogue yet</p>
                        <p>
                          {catalogueWarning ||
                            'Ask the supplier to publish finished goods/services or share a price list with you.'}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link
                            href="/dashboard/connections/pricing"
                            className="font-bold text-[#00b4d8] underline"
                          >
                            Pricing agreements
                          </Link>
                          <Link
                            href="/dashboard/connections"
                            className="font-bold text-slate-600 underline"
                          >
                            Network
                          </Link>
                        </div>
                      </div>
                    )}
                  {selectedSupplier.linked_profile_id &&
                    catalogueGroups.unfilteredTotal > 0 && (
                      <input
                        type="search"
                        className="input !p-2 !text-sm w-full mb-2 bg-white"
                        placeholder="Search catalogue (name, SKU, type)…"
                        value={catalogueSearch}
                        onChange={(e) => setCatalogueSearch(e.target.value)}
                      />
                    )}
                  {catalogueSearch &&
                    catalogueGroups.total === 0 &&
                    catalogueGroups.unfilteredTotal > 0 && (
                      <p className="text-[11px] text-slate-500 mb-2">
                        No products match “{catalogueSearch}”. Clear search or use
                        free text.
                      </p>
                    )}
                  {catalogueGroups.agreement.length > 0 && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Agreed list ({catalogueGroups.agreement.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto mb-2">
                        {catalogueGroups.agreement.map((l) => (
                          <button
                            key={l.key}
                            type="button"
                            onClick={() => addCatalogueLine(l)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-300/50 bg-white text-slate-700 hover:bg-emerald-50"
                            title="Add line at agreed list price"
                          >
                            {l.product_name}
                            <span className="text-neutral-400 font-normal ml-1">
                              @ {Number(l.unit_price).toFixed(2)}{' '}
                              {l.currency || poCurrency}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {catalogueGroups.inventoryByType.length > 0 && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Their inventory (
                        {catalogueGroups.inventoryByType.reduce(
                          (s, g) => s + g.items.length,
                          0
                        )}
                        )
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {catalogueGroups.inventoryByType
                          .flatMap((g) => g.items)
                          .slice(0, 48)
                          .map((l) => (
                            <button
                              key={l.key}
                              type="button"
                              onClick={() => addCatalogueLine(l)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00b4d8]/30 bg-white text-slate-700 hover:bg-[#00b4d8]/10"
                              title={`${productTypeLabel(l.product_type)} · add from supplier inventory`}
                            >
                              {l.product_name}
                              {l.sku ? (
                                <span className="text-neutral-400 font-normal ml-1">
                                  {l.sku}
                                </span>
                              ) : null}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                  <p className="text-[10px] text-neutral-500 mt-2">
                    <Link
                      href="/dashboard/connections/pricing"
                      className="text-[#00b4d8] underline"
                    >
                      Manage pricing agreements
                    </Link>
                    {' · '}
                    <Link
                      href="/dashboard/connections"
                      className="text-[#00b4d8] underline"
                    >
                      Network
                    </Link>
                    {' · '}
                    <Link
                      href="/dashboard/customers/orders?tab=inbound"
                      className="text-slate-600 underline"
                    >
                      Your inbound POs (as seller)
                    </Link>
                  </p>
                </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <label className="text-xs font-medium">Line items *</label>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {selectedSrmId
                      ? catalogueLoading
                        ? 'Loading this supplier’s catalogue…'
                        : supplierCatalogue.length
                          ? `Pick from ${selectedSupplier?.trading_name || 'supplier'} catalogue (${supplierCatalogue.length}) or free text.`
                          : 'No supplier catalogue yet — free-text lines still work. Connect them and share pricing/inventory.'
                      : 'Select a supplier first to load their catalogue.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLineItems([
                      ...lineItems,
                      {
                        product_id: null,
                        item_name: '',
                        quantity: 1,
                        unit_price: 0,
                        uom: 'ea',
                      },
                    ]);
                    setLineCatalogueKeys((k) => [...k, null]);
                  }}
                  className="text-xs font-semibold text-[#00b4d8]"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => {
                  const catKey = lineCatalogueKeys[idx] || null;
                  const linked =
                    catKey
                      ? supplierCatalogue.find((c) => c.key === catKey)
                      : item.product_id
                        ? supplierCatalogue.find(
                            (c) =>
                              c.seller_product_id != null &&
                              Number(c.seller_product_id) ===
                                Number(item.product_id)
                          )
                        : null;
                  const selectValue = linked?.key || 'custom';
                  const showNameInput = !linked;
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-start border rounded-2xl p-2.5 bg-neutral-50/50"
                    >
                      <div className="col-span-12 sm:col-span-5 space-y-1.5">
                        <select
                          className="input !p-2 !text-sm w-full font-medium"
                          value={selectValue}
                          disabled={!selectedSrmId}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'custom') {
                              applyCatalogueItem(idx, null);
                            } else {
                              applyCatalogueItem(idx, v);
                            }
                          }}
                          aria-label={`Line ${idx + 1} supplier product`}
                        >
                          <option value="custom">
                            Custom / free text…
                          </option>
                          {catalogueGroups.agreement.length > 0 && (
                            <optgroup label="Agreed list prices">
                              {catalogueGroups.agreement.map((p) => (
                                <option key={p.key} value={p.key}>
                                  {p.product_name}
                                  {p.sku ? ` (${p.sku})` : ''}
                                  {p.unit_price > 0
                                    ? ` · ${p.currency} ${Number(p.unit_price).toFixed(2)}`
                                    : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {catalogueGroups.inventoryByType.map(
                            ({ type, items }) => (
                              <optgroup
                                key={type}
                                label={`Supplier · ${productTypeLabel(type)}`}
                              >
                                {items.map((p) => (
                                  <option key={p.key} value={p.key}>
                                    {p.product_name}
                                    {p.sku ? ` (${p.sku})` : ''}
                                    {p.unit_price > 0
                                      ? ` · ${p.currency} ${Number(p.unit_price).toFixed(2)}`
                                      : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          )}
                        </select>
                        {showNameInput ? (
                          <input
                            className="input !p-2 !text-sm w-full"
                            placeholder="Item description (free text)"
                            value={item.item_name}
                            onChange={(e) => {
                              const u = [...lineItems];
                              u[idx] = {
                                ...u[idx],
                                product_id: null,
                                item_name: e.target.value,
                              };
                              setLineItems(u);
                              setLineCatalogueKeys((keys) => {
                                const k = [...keys];
                                while (k.length <= idx) k.push(null);
                                k[idx] = null;
                                return k;
                              });
                            }}
                          />
                        ) : (
                          <p className="text-[10px] text-neutral-500 px-0.5 leading-relaxed">
                            <span className="font-semibold text-slate-700">
                              {item.item_name}
                            </span>
                            {' · '}
                            {linked?.source === 'agreement'
                              ? 'Agreed list'
                              : productTypeLabel(linked?.product_type)}
                            {linked?.sku ? ` · SKU ${linked.sku}` : ''}
                            {linked?.agreement_title
                              ? ` · ${linked.agreement_title}`
                              : ''}
                            {' · '}
                            <button
                              type="button"
                              className="text-[#00b4d8] font-semibold underline-offset-2 hover:underline"
                              onClick={() => {
                                const u = [...lineItems];
                                u[idx] = {
                                  ...u[idx],
                                  product_id: null,
                                };
                                setLineItems(u);
                                setLineCatalogueKeys((keys) => {
                                  const k = [...keys];
                                  while (k.length <= idx) k.push(null);
                                  k[idx] = null;
                                  return k;
                                });
                              }}
                            >
                              Edit as free text
                            </button>
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        className="input !p-2 !text-sm col-span-4 sm:col-span-2"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const u = [...lineItems];
                          u[idx] = {
                            ...u[idx],
                            quantity: Number(e.target.value),
                          };
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
                          u[idx] = {
                            ...u[idx],
                            unit_price: Number(e.target.value),
                          };
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
                        onClick={() => {
                          if (lineItems.length <= 1) return;
                          setLineItems(lineItems.filter((_, i) => i !== idx));
                          setLineCatalogueKeys((keys) =>
                            keys.filter((_, i) => i !== idx)
                          );
                        }}
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PO type: standard vs escrow — always explicit */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Purchase order type
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseEscrow(false)}
                  className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                    !useEscrow
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200'
                      : 'border-neutral-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Standard PO
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                    Off-chain only. Send, accept, record delivery (OTIFEF), rate supplier. No wallet
                    required.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (escrowEnabled) setUseEscrow(true);
                    else
                      toast.error(
                        'Escrow disabled. Set NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=true (default is on).'
                      );
                  }}
                  disabled={!escrowEnabled}
                  className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                    useEscrow && escrowEnabled
                      ? 'border-[#00b4d8] bg-[#00b4d8]/10 shadow-sm ring-1 ring-[#00b4d8]/30'
                      : 'border-neutral-200 bg-white hover:border-[#00b4d8]/40'
                  } ${!escrowEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <Shield className="w-4 h-4 text-[#00b4d8]" />
                    Escrow PO
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                    On-chain funds locked until delivery. Connect wallet, set supplier 0x address,
                    then create → fund → ship → confirm.
                  </p>
                </button>
              </div>

              {useEscrow && escrowEnabled && (
                <div className="space-y-3 pt-1 border-t border-neutral-100">
                  <div className="flex flex-wrap gap-2">
                    {usdcEnabled && (
                      <button
                        type="button"
                        onClick={() => setEscrowAsset('usdc')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                          escrowAsset === 'usdc'
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white border-neutral-200'
                        }`}
                      >
                        USDC (Base) · recommended
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEscrowAsset('eth')}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                        escrowAsset === 'eth'
                          ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                          : 'bg-white border-neutral-200'
                      }`}
                    >
                      ETH (Sepolia · dev)
                    </button>
                  </div>
                  {!usdcEnabled && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                      ETH Sepolia escrow is available. Deploy USDC escrow and set{' '}
                      <code>NEXT_PUBLIC_USDC_ESCROW_ADDRESS</code> for the recommended stablecoin path.
                    </p>
                  )}
                  <div>
                    <label className="text-xs font-medium">Supplier wallet (0x) *</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm font-mono"
                      placeholder="0x…"
                      value={supplierWallet}
                      onChange={(e) => setSupplierWallet(e.target.value)}
                    />
                  </div>
                  {escrowAsset === 'eth' && (
                    <div>
                      <label className="text-xs font-medium">
                        Escrow amount (ETH) — optional override
                      </label>
                      <input
                        className="input mt-1 w-full !p-3 !text-sm font-mono"
                        placeholder={`Auto ≈ ${fiatToEthString(totalAmount, ETH_RATE_ZAR)} from PO total`}
                        value={escrowEthOverride}
                        onChange={(e) => setEscrowEthOverride(e.target.value)}
                      />
                      <p className="text-[11px] text-amber-800 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                        Dev path: empty uses fiat÷{ETH_RATE_ZAR.toLocaleString()} rate.
                      </p>
                    </div>
                  )}
                  {connectedWallet ? (
                    <p className="text-[11px] text-emerald-700">
                      Buyer wallet connected: {connectedWallet.slice(0, 6)}…
                      {connectedWallet.slice(-4)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-700 font-medium">
                      Connect wallet above before sending an escrow PO.
                    </p>
                  )}
                  {escrowAsset === 'usdc' && usdcEnabled && supplierWallet && (
                    <UsdcEscrowActions
                      supplierWallet={supplierWallet}
                      fiatAmount={totalAmount}
                      metadataURI={`https://supplieradvisor.com/po/draft`}
                      onCreated={({ onchainPoId, txHash }) => {
                        toast.success(
                          `USDC createPO #${onchainPoId} — raise PO then link tx ${txHash.slice(0, 10)}…`
                        );
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2 border-t">
              {/* Two first-class paths — mode passed explicitly (no setState race) */}
              <button
                type="button"
                disabled={saving || isContractPending}
                onClick={() => {
                  setUseEscrow(false);
                  void handleRaisePO(false, { mode: 'standard' });
                }}
                className={`${
                  !useEscrow ? 'btn-primary' : 'btn-secondary'
                } !py-3 !px-6 text-sm inline-flex items-center gap-2`}
              >
                {saving && !useEscrow ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Truck className="w-4 h-4" /> Send standard PO
                  </>
                )}
              </button>
              {escrowEnabled && (
                <button
                  type="button"
                  disabled={saving || isContractPending}
                  onClick={() => {
                    setUseEscrow(true);
                    void handleRaisePO(false, { mode: 'escrow' });
                  }}
                  className={`${
                    useEscrow ? 'btn-primary' : 'btn-secondary'
                  } !py-3 !px-6 text-sm inline-flex items-center gap-2`}
                >
                  {saving && useEscrow ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-4 h-4" /> Send escrow PO
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleRaisePO(true, { mode: 'standard' })}
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
                  {escrowAsset === 'usdc'
                    ? 'USDC escrow on Base (recommended)'
                    : `≈ ${amountInEth(totalAmount)} ETH escrow (dev)`}
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
                          {(() => {
                            const step = buyerNextStep(po);
                            if (!step) return null;
                            const tone =
                              step.tone === 'amber'
                                ? 'border-amber-100 bg-amber-50/80 text-amber-950'
                                : step.tone === 'sky'
                                  ? 'border-sky-100 bg-sky-50/80 text-sky-950'
                                  : step.tone === 'emerald'
                                    ? 'border-emerald-100 bg-emerald-50/80 text-emerald-950'
                                    : 'border-slate-100 bg-slate-50 text-slate-800';
                            return (
                              <div
                                className={`mt-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${tone}`}
                              >
                                <span className="font-bold">{step.title}</span>
                                {' — '}
                                {step.body}
                              </div>
                            );
                          })()}
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
                              className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                            >
                              <Package className="w-3 h-3" /> Receive + OTIFEF
                            </button>
                          )}
                          {['accepted', 'funded', 'sent', 'completed'].includes(
                            String(po.status)
                          ) &&
                            !(
                              po.metadata &&
                              typeof po.metadata === 'object' &&
                              (po.metadata as { inventory_received_at?: string })
                                .inventory_received_at
                            ) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void receiveToStock(po)}
                                className="btn-secondary !py-1.5 !px-3 text-xs"
                                title="Match lines to your products by source/SKU/name and increase stock"
                              >
                                Receive to stock
                              </button>
                            )}
                          {po.metadata &&
                            typeof po.metadata === 'object' &&
                            (po.metadata as { fulfilment_status?: string })
                              .fulfilment_status === 'shipped' && (
                              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-100 text-sky-800">
                                Supplier shipped
                              </span>
                            )}
                          {escrowEnabled && onchain && po.status === 'funded' && (
                            <button
                              type="button"
                              disabled={isContractPending}
                              onClick={() => submitShipOnchain(po)}
                              className="btn-secondary !py-1.5 !px-3 text-xs"
                              title="Must be signed by the supplier wallet registered on-chain"
                            >
                              <Truck className="w-3 h-3" /> Mark shipped
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
                                title="Buyer confirmDelivery — pays supplier after markShipped"
                              >
                                Confirm & pay
                              </button>
                            )}
                          {(po.status === 'completed' || po.status === 'paid') && (
                            <Link
                              href={
                                po.supplier_profile_id || po.supplier_id
                                  ? `/dashboard/suppliers/ratings?ratee=${po.supplier_profile_id || po.supplier_id}`
                                  : '/dashboard/suppliers/ratings'
                              }
                              className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                            >
                              <Star className="w-3 h-3" /> Rate supplier
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
              One-tap receive: delivered qty defaults to ordered lines. OTIFEF =
              On-Time · In-Full · Error-Free. Then rate the supplier.
            </p>
            {Array.isArray(deliveryPo.items) && deliveryPo.items.length > 0 && (
              <ul className="mb-3 text-[11px] text-slate-600 space-y-1 max-h-24 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                {deliveryPo.items.map((line, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">
                      {line.item_name || 'Line'}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {line.quantity} {line.uom || 'ea'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
                  <button
                    type="button"
                    className="mt-1 text-[10px] font-bold text-[#00b4d8] hover:underline"
                    onClick={() => {
                      const orderQty =
                        Number(deliveryPo.order_quantity) ||
                        (deliveryPo.items || []).reduce(
                          (s, i) => s + Number(i.quantity || 0),
                          0
                        );
                      setDeliveryForm((f) => ({
                        ...f,
                        delivered_quantity: orderQty,
                        damaged_quantity: 0,
                      }));
                    }}
                  >
                    Fill = ordered (in-full)
                  </button>
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
            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={() => void submitDelivery({ rateAfter: true })}
                className="btn-primary w-full !py-3 inline-flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4" />
                Complete OTIFEF + rate supplier
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryPo(null)}
                  className="btn-secondary flex-1 !py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitDelivery({ rateAfter: false })}
                  className="btn-secondary flex-1 !py-2.5 text-sm"
                >
                  Save OTIFEF only
                </button>
              </div>
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
        <h3 className="font-bold text-lg mb-2">Escrow PO (on-chain)</h3>
        {escrowEnabled ? (
          <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside">
            <li>On Create tab, choose <strong>Escrow PO</strong></li>
            <li>Connect wallet and enter supplier 0x address</li>
            {ESCROW_LIFECYCLE.map((s) => (
              <li key={s.fn}>
                <code className="text-xs bg-neutral-100 px-1 rounded">{s.fn}</code> — {s.label} (
                {s.role})
              </li>
            ))}
            <li>Server verifies receipt before saving on-chain refs</li>
            <li>Record OTIFEF delivery + rate supplier off-chain</li>
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">
            Escrow is disabled. Set NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=true (default is on) to
            enable escrow POs alongside standard POs.
          </p>
        )}
        <p className="text-xs text-neutral-500 mt-4">
          ETH contract: {PO_ESCROW_ADDRESS.slice(0, 10)}… · client-signed · receipt verified
        </p>
      </div>
    </div>
  );
}
