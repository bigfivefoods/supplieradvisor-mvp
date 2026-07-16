'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/utils/supabase/client';
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
  Building2,
  FileText,
  X,
  Loader2,
  ArrowLeft,
  Wallet,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  BUYER_PO_CANCEL_STATUSES,
  isCustomerPoEscrowEnabled,
} from '@/lib/procurement/types';
import { CONTRACTS } from '@/lib/contracts/config';
import POEscrowV2ABI from '@/lib/contracts/abi/POEscrowV2.json';
import {
  fiatToEthString,
  getEthDemoRateFiat,
  getPoEscrowAddress,
  type EscrowLinkKind,
} from '@/lib/contracts/escrow';
// fiatToEthString used for placeholder when override empty
import WalletConnectBar from '@/components/onchain/WalletConnectBar';

const PO_ESCROW_ADDRESS = getPoEscrowAddress() || CONTRACTS.POEscrowV2.address;
/**
 * Demo-only ZAR→ETH rate (matches suppliers/po). Drives real msg.value for fundPO —
 * override with NEXT_PUBLIC_ETH_DEMO_RATE.
 */
const ETH_RATE_ZAR = getEthDemoRateFiat();

type PendingEscrowLink = {
  supabasePoId: number;
  txHash: `0x${string}`;
  supplierWallet: string | null;
  /** Known chain id when funding (no PO_Created log expected) */
  onchainPoId: string | number | null;
  kind: EscrowLinkKind;
};

interface LineItem {
  product_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom: string | null;
  /** Product passport public id when linked to inventory */
  public_id?: string | null;
}

interface ConnectedSupplier {
  connectionId: number;
  supplierProfileId: number;
  trading_name: string | null;
  legal_name: string | null;
  wallet_address: string | null;
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
  onchain_tx?: string | null;
  onchain_po_id?: string | number | null;
  supplier_wallet?: string | null;
}

export default function BuyerPurchaseOrdersPage() {
  const { user } = usePrivy();
  const supabase = createClient();
  const companyId = getSelectedCompanyId();
  const companyName = getSelectedCompanyName();
  const privyUserId = getCanonicalUserId(user?.id);

  const escrowEnabled = isCustomerPoEscrowEnabled();
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

  /**
   * After writeContract is submitted: wait for confirm, then trust-then-audit persist.
   * Kept in refs so confirmation effect can pick them up once.
   */
  const pendingSubmitRef = useRef<{
    supabasePoId: number;
    supplierWallet: string | null;
    onchainPoId: string | number | null;
    kind: EscrowLinkKind;
  } | null>(null);
  const autoLinkDoneForHashRef = useRef<string | null>(null);
  /** Avoid re-toasting the same writeContract error */
  const writeErrorToastedRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  /** Confirmed tx awaiting (or failed) server persist — enables Retry link */
  const [pendingLink, setPendingLink] = useState<PendingEscrowLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ConnectedSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [useEscrow, setUseEscrow] = useState(false);
  const [supplierWallet, setSupplierWallet] = useState('');
  const [escrowEthOverride, setEscrowEthOverride] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: null },
  ]);
  const [catalogue, setCatalogue] = useState<
    Array<{
      key: string;
      product_name: string;
      seller_product_id: number | null;
      unit_price: number;
      uom: string | null;
      public_id?: string | null;
      product_type?: string | null;
      sku?: string | null;
    }>
  >([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null);

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
    let profiles: {
      id: number;
      trading_name: string | null;
      legal_name: string | null;
      wallet_address: string | null;
    }[] = [];
    if (supplierIds.length) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, wallet_address')
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
          wallet_address: profile?.wallet_address ?? null,
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
    let pos = (json.purchaseOrders || []) as PurchaseOrder[];
    // Enrich line items with product passport public_id when product_id is set
    const productIds = new Set<number>();
    for (const po of pos) {
      for (const it of po.items || []) {
        if (it.product_id != null && Number.isFinite(Number(it.product_id))) {
          productIds.add(Number(it.product_id));
        }
      }
    }
    if (productIds.size > 0) {
      try {
        const { data: prods } = await supabase
          .from('products')
          .select('id, public_id')
          .in('id', [...productIds]);
        const map = new Map(
          (prods || []).map((p: { id: number; public_id?: string | null }) => [
            Number(p.id),
            p.public_id ? String(p.public_id) : null,
          ])
        );
        pos = pos.map((po) => ({
          ...po,
          items: (po.items || []).map((it) => ({
            ...it,
            public_id:
              it.public_id ||
              (it.product_id != null ? map.get(Number(it.product_id)) : null) ||
              null,
          })),
        }));
      } catch {
        /* soft — passport optional */
      }
    }
    setPurchaseOrders(pos);
  }, [companyId, privyUserId, supabase]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadSuppliers(), loadPOs()]).finally(() => setLoading(false));
  }, [companyId, loadSuppliers, loadPOs]);

  // Prefill supplier wallet when selecting a connected supplier
  useEffect(() => {
    if (selectedSupplier?.wallet_address) {
      setSupplierWallet(selectedSupplier.wallet_address);
    }
  }, [selectedSupplier?.supplierProfileId, selectedSupplier?.wallet_address]);

  // Load supplier sellable catalogue + passport ids for picker
  useEffect(() => {
    if (!companyId || !selectedSupplierId || !privyUserId) {
      setCatalogue([]);
      setCatalogueWarning(null);
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueWarning(null);
    (async () => {
      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          sellerProfileId: String(selectedSupplierId),
          privyUserId,
        });
        const res = await fetch(`/api/suppliers/catalogue?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setCatalogue([]);
          setCatalogueWarning(
            data.error || 'Catalogue unavailable — use free-text lines.'
          );
          return;
        }
        setCatalogue(Array.isArray(data.items) ? data.items : []);
        setCatalogueWarning(
          typeof data.warning === 'string' ? data.warning : null
        );
      } catch {
        if (!cancelled) {
          setCatalogue([]);
          setCatalogueWarning('Could not load catalogue');
        }
      } finally {
        if (!cancelled) setCatalogueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedSupplierId, privyUserId]);

  const addFromCatalogue = (item: {
    product_name: string;
    seller_product_id: number | null;
    unit_price: number;
    uom: string | null;
    public_id?: string | null;
  }) => {
    setLineItems((prev) => {
      const emptyIdx = prev.findIndex(
        (l) => !l.item_name.trim() && l.product_id == null
      );
      const row: LineItem = {
        product_id: item.seller_product_id,
        item_name: item.product_name,
        quantity: 1,
        unit_price: Number(item.unit_price) || 0,
        uom: item.uom,
        public_id: item.public_id || null,
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = row;
        return next;
      }
      return [...prev, row];
    });
    toast.success(`Added ${item.product_name}`);
  };

  // Surface async wallet reject / writeContract failures (try/catch around writeContract is sync-only)
  useEffect(() => {
    if (!isWriteError || !writeError) return;
    const msg = writeError.message || 'Wallet transaction failed or was rejected';
    if (writeErrorToastedRef.current === msg) return;
    writeErrorToastedRef.current = msg;

    const pending = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    autoLinkDoneForHashRef.current = null;

    const kindLabel = pending?.kind === 'fund' ? 'fundPO' : 'createPO';
    const poHint = pending?.supabasePoId
      ? ` Off-chain PO #${pending.supabasePoId} is unchanged` +
        (pending.kind === 'create'
          ? ' — use Create on-chain escrow when ready.'
          : '.')
      : '';
    toast.error(`${kindLabel} failed: ${msg}.${poHint}`);
  }, [isWriteError, writeError]);

  /**
   * Parse receipt + POST trust-then-audit persist.
   * On failure keeps `pendingLink` so the user can Retry without a second createPO.
   */
  const persistEscrowLink = useCallback(
    async (link: PendingEscrowLink) => {
      if (!companyId || !privyUserId) {
        setLinkError('Select a company and sign in to link on-chain refs');
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
        const parsedLogs = parseEventLogs({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          abi: POEscrowV2ABI.abi as any,
          // ABI event is PO_Created (not POCreated) — src/lib/contracts/abi/POEscrowV2.json
          eventName: 'PO_Created',
          logs: receipt.logs,
        });

        let poIdOnChain: number | string | null = null;
        if (parsedLogs.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventArgs = (parsedLogs[0] as any).args;
          const parsed = Number(eventArgs?.poId ?? eventArgs?.[0]);
          if (Number.isFinite(parsed) && parsed > 0) {
            poIdOnChain = parsed;
          }
        }
        // At this point poIdOnChain is only number | null (from event parse);
        // fall back to a known id on fundPO or when the event is missing.
        if (
          poIdOnChain == null &&
          link.onchainPoId != null &&
          link.onchainPoId !== ''
        ) {
          poIdOnChain = link.onchainPoId;
        }
        if (poIdOnChain == null || poIdOnChain === '' || !/^[1-9]\d*$/.test(String(poIdOnChain))) {
          throw new Error(
            'Could not parse on-chain PO id from receipt (expected PO_Created). Use Retry link after the tx confirms.'
          );
        }

        const res = await fetch(`/api/buyer/purchase-orders/${link.supabasePoId}/onchain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerCompanyId: companyId,
            privyUserId,
            onchain_tx: link.txHash,
            onchain_po_id: poIdOnChain,
            supplier_wallet: link.supplierWallet || undefined,
            kind: link.kind,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Failed to save on-chain refs');
        }

        toast.success(
          link.kind === 'create'
            ? `On-chain escrow linked (chain PO #${poIdOnChain})`
            : link.kind === 'fund'
              ? `Fund recorded for chain PO #${poIdOnChain}`
              : link.kind === 'ship'
                ? `Shipped recorded for chain PO #${poIdOnChain}`
                : `Delivery confirmed — supplier paid (chain PO #${poIdOnChain})`
        );
        setPendingLink(null);
        setLinkError(null);
        pendingSubmitRef.current = null;
        resetWrite();
        await loadPOs();
      } catch (e: unknown) {
        console.error('Failed to link onchain PO:', e);
        const msg = e instanceof Error ? e.message : 'Failed to link on-chain PO';
        setLinkError(msg);
        setPendingLink(link);
        toast.error(msg);
      } finally {
        setLinking(false);
      }
    },
    [companyId, privyUserId, publicClient, loadPOs, resetWrite]
  );

  // After wallet confirms createPO/fundPO, auto-link once per hash
  useEffect(() => {
    if (!isConfirmed || !txHash) return;
    if (autoLinkDoneForHashRef.current === txHash) return;
    const submit = pendingSubmitRef.current;
    if (!submit) return;

    autoLinkDoneForHashRef.current = txHash;
    const link: PendingEscrowLink = {
      supabasePoId: submit.supabasePoId,
      txHash,
      supplierWallet: submit.supplierWallet,
      onchainPoId: submit.onchainPoId,
      kind: submit.kind,
    };
    void persistEscrowLink(link);
  }, [isConfirmed, txHash, persistEscrowLink]);

  const retryPendingLink = () => {
    if (!pendingLink || linking) return;
    void persistEscrowLink(pendingLink);
  };

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

  const amountInEth = (amountZar: number) => {
    const o = escrowEthOverride.trim();
    if (o && Number.isFinite(Number(o)) && Number(o) > 0) {
      return Number(o).toFixed(6);
    }
    return fiatToEthString(amountZar, ETH_RATE_ZAR);
  };

  /** Buyer confirmDelivery — pays supplier after markShipped */
  const confirmDeliveryOnchain = (po: PurchaseOrder) => {
    if (!escrowEnabled) return;
    if (!connectedWallet) {
      toast.error('Connect your wallet to confirm delivery');
      return;
    }
    const onchainId = po.onchain_po_id;
    if (onchainId == null || onchainId === '') {
      toast.error('No on-chain PO id linked yet');
      return;
    }
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    writeErrorToastedRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId: po.id,
      supplierWallet: po.supplier_wallet || null,
      onchainPoId: onchainId,
      kind: 'release',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'confirmDelivery',
        args: [BigInt(String(onchainId))],
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          autoLinkDoneForHashRef.current = null;
          const msg = err?.message || 'Wallet rejected confirmDelivery';
          writeErrorToastedRef.current = msg;
          toast.error(
            `confirmDelivery failed: ${msg}. Supplier must call markShipped first.`
          );
        },
      }
    );
    toast.message(`Confirming delivery for chain PO #${onchainId}…`);
  };

  /** Client-signed createPO — never POEscrowService / server key */
  const submitCreateOnchain = (supabasePoId: number, wallet: string, amountZar: number) => {
    const eth = amountInEth(amountZar);
    const metadataURI = `https://supplieradvisor.app/po/${supabasePoId}`;
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
          const msg = err?.message || 'Wallet rejected createPO';
          writeErrorToastedRef.current = msg;
          toast.error(
            `createPO failed: ${msg}. Off-chain PO #${supabasePoId} remains — use Create on-chain escrow when ready.`
          );
        },
      }
    );
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

    const wantEscrow = escrowEnabled && useEscrow;
    if (wantEscrow) {
      if (!connectedWallet) {
        toast.error('Connect your wallet to create on-chain escrow');
        return;
      }
      if (!supplierWallet.trim() || !/^0x[a-fA-F0-9]{40}$/.test(supplierWallet.trim())) {
        toast.error('Valid supplier wallet address (0x…) is required for escrow');
        return;
      }
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
          useEscrow: wantEscrow,
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

      const newPo = json.purchaseOrder as PurchaseOrder | undefined;
      const newId = newPo?.id;
      const amount = Number(newPo?.total_amount ?? totalAmount);

      if (wantEscrow && newId) {
        toast.success(
          `Off-chain PO #${newId} created. Confirm wallet createPO (~${amountInEth(amount)} ETH demo rate), or use Create on-chain escrow later if the wallet is cancelled.`
        );
        submitCreateOnchain(newId, supplierWallet.trim(), amount);
      } else {
        toast.success(`Purchase order #${newId ?? ''} created`);
      }

      setSelectedSupplierId(null);
      setDescription('');
      setUseEscrow(false);
      setSupplierWallet('');
      setLineItems([{ product_id: null, item_name: '', quantity: 1, unit_price: 0, uom: null }]);
      await loadPOs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error creating PO');
    } finally {
      setSaving(false);
    }
  };

  const createOnchainEscrowForPo = (po: PurchaseOrder) => {
    if (!escrowEnabled) return;
    if (!connectedWallet) {
      toast.error('Connect your wallet to create on-chain escrow');
      return;
    }
    let wallet = po.supplier_wallet || '';
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const prompted = window.prompt('Enter supplier wallet address (0x…):', supplierWallet || '');
      if (!prompted || !/^0x[a-fA-F0-9]{40}$/.test(prompted.trim())) {
        toast.error('Valid supplier wallet required');
        return;
      }
      wallet = prompted.trim();
    }
    const amount = Number(po.total_amount ?? po.subtotal ?? 0);
    const eth = amountInEth(amount);
    toast.message(
      `Creating on-chain escrow for PO #${po.id} (demo amount ${eth} ETH @ R${ETH_RATE_ZAR}/ETH)…`
    );
    submitCreateOnchain(po.id, wallet, amount);
  };

  const fundOnchainPO = (po: PurchaseOrder) => {
    if (!escrowEnabled) return;
    if (!connectedWallet) {
      toast.error('Connect your wallet to fund escrow');
      return;
    }
    const onchainId = po.onchain_po_id;
    if (onchainId == null || onchainId === '') {
      toast.error('No on-chain PO id linked yet');
      return;
    }
    const amount = Number(po.total_amount ?? po.subtotal ?? 0);
    const eth = amountInEth(amount);
    setLinkError(null);
    autoLinkDoneForHashRef.current = null;
    writeErrorToastedRef.current = null;
    pendingSubmitRef.current = {
      supabasePoId: po.id,
      supplierWallet: po.supplier_wallet || null,
      onchainPoId: onchainId,
      kind: 'fund',
    };
    writeContract(
      {
        address: PO_ESCROW_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: POEscrowV2ABI.abi as any,
        functionName: 'fundPO',
        args: [BigInt(String(onchainId))],
        value: parseEther(eth),
      },
      {
        onError: (err) => {
          pendingSubmitRef.current = null;
          autoLinkDoneForHashRef.current = null;
          const msg = err?.message || 'Wallet rejected fundPO';
          writeErrorToastedRef.current = msg;
          toast.error(`fundPO failed: ${msg}. Off-chain PO #${po.id} is unchanged.`);
        },
      }
    );
    toast.message(
      `Funding on-chain PO #${onchainId} with ${eth} ETH (demo rate R${ETH_RATE_ZAR}/ETH)…`
    );
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

  const busy = saving || isContractPending || isConfirming || linking;

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
              Connected suppliers only
              {escrowEnabled
                ? ' · optional client-signed on-chain escrow'
                : ' · off-chain PO (escrow flag off)'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/buyer/reviews"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Post-PO reviews
            </Link>
            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-4 py-2">
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-semibold text-sm">{companyName}</span>
            </div>
          </div>
        </div>

        {escrowEnabled && (
          <div className="mb-6">
            <WalletConnectBar />
          </div>
        )}

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
                        <div
                          key={s.connectionId}
                          className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center justify-between ${
                            selected
                              ? 'border-[#00b4d8] bg-[#00b4d8]/5'
                              : s.suspended
                                ? 'border-neutral-100 bg-neutral-50 opacity-60'
                                : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={s.suspended}
                            onClick={() => setSelectedSupplierId(s.supplierProfileId)}
                            className={`flex-1 text-left min-w-0 ${
                              s.suspended ? 'cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-neutral-500">
                              ID {s.supplierProfileId}
                              {s.wallet_address ? ' · has wallet' : ''}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.suspended && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Suspended
                              </span>
                            )}
                            {selected && (
                              <button
                                type="button"
                                aria-label="Clear selected supplier"
                                onClick={() => setSelectedSupplierId(null)}
                                className="text-neutral-400 hover:text-red-500 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
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

              {escrowEnabled && (
                <div className="mb-6 p-4 rounded-2xl border border-neutral-200 bg-neutral-50/80">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useEscrow}
                      onChange={(e) => setUseEscrow(e.target.checked)}
                      className="w-4 h-4 accent-[#00b4d8]"
                    />
                    <Wallet className="w-4 h-4 text-[#00b4d8]" />
                    Create on-chain escrow (client-signed POEscrowV2)
                  </label>
                  <p className="text-xs text-neutral-500 mt-2 ml-6">
                    Off-chain PO is created first; your connected wallet signs createPO. Server never
                    signs with a platform private key. Demo ETH amount uses a fixed ZAR rate of R
                    {ETH_RATE_ZAR.toLocaleString()}/ETH (not for production).
                    {useEscrow && totalAmount > 0 && (
                      <>
                        {' '}
                        ≈ {amountInEth(totalAmount)} ETH for this PO.
                      </>
                    )}
                  </p>
                  {useEscrow && (
                    <div className="mt-3 ml-6 space-y-3">
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">
                          Supplier wallet address
                        </label>
                        <input
                          type="text"
                          value={supplierWallet}
                          onChange={(e) => setSupplierWallet(e.target.value)}
                          className="w-full px-4 py-3 border border-neutral-200 rounded-2xl font-mono text-sm focus:border-[#00b4d8]"
                          placeholder="0x…"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">
                          Escrow amount (ETH) — optional override
                        </label>
                        <input
                          type="text"
                          value={escrowEthOverride}
                          onChange={(e) => setEscrowEthOverride(e.target.value)}
                          className="w-full px-4 py-3 border border-neutral-200 rounded-2xl font-mono text-sm focus:border-[#00b4d8]"
                          placeholder={`Auto ≈ ${fiatToEthString(totalAmount, ETH_RATE_ZAR)} ETH`}
                        />
                        <p className="text-[11px] text-amber-800 mt-1">
                          Leave empty for demo fiat conversion. Enter exact ETH for real testnet
                          funds.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {escrowEnabled && pendingLink && (
                <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50">
                  <div className="text-sm font-medium text-amber-900">
                    {linkError
                      ? 'On-chain tx confirmed but link to this PO failed'
                      : linking
                        ? 'Linking on-chain escrow…'
                        : 'Pending on-chain link'}
                  </div>
                  <p className="text-xs text-amber-800 mt-1 font-mono break-all">
                    PO #{pendingLink.supabasePoId} · {pendingLink.kind} · {pendingLink.txHash}
                  </p>
                  {linkError && (
                    <p className="text-xs text-red-700 mt-1">{linkError}</p>
                  )}
                  <button
                    type="button"
                    disabled={linking}
                    onClick={retryPendingLink}
                    className="mt-3 px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-xl disabled:bg-neutral-300"
                  >
                    {linking ? 'Retrying…' : 'Retry link'}
                  </button>
                </div>
              )}

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

                {selectedSupplierId ? (
                  <div className="mb-4 rounded-2xl border border-cyan-100 bg-sky-50/50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#0077b6] mb-2">
                      Supplier catalogue
                      {catalogueLoading ? ' · loading…' : ''}
                    </div>
                    {catalogueWarning ? (
                      <p className="text-xs text-amber-800 mb-2">{catalogueWarning}</p>
                    ) : null}
                    {!catalogueLoading && catalogue.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        No sellable lines published — use free-text items below, or ask the
                        supplier to publish finished goods.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                        {catalogue.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => addFromCatalogue(c)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:border-[#00b4d8] hover:bg-[#e0f7fc]"
                            title={
                              c.public_id
                                ? `Add line · passport /p/${c.public_id}`
                                : 'Add line from catalogue'
                            }
                          >
                            {c.product_name}
                            {c.public_id ? (
                              <span className="text-emerald-700" title="Has product passport">
                                ◆
                              </span>
                            ) : null}
                            <span className="text-neutral-400 font-normal">
                              R{Number(c.unit_price || 0).toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {catalogue.some((c) => c.public_id) ? (
                      <p className="mt-2 text-[10px] text-neutral-500">
                        ◆ = product passport available after add (opens /p/… from your PO list).
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
                      {item.public_id ? (
                        <a
                          href={`/p/${item.public_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-emerald-700 hover:underline mt-1 inline-block"
                        >
                          Passport /p/{item.public_id}
                        </a>
                      ) : null}
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
                    busy ||
                    !selectedSupplierId ||
                    !!selectedSupplier?.suspended ||
                    suppliers.length === 0
                  }
                  className="px-8 py-3 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300 flex items-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  {busy
                    ? isConfirming
                      ? 'Confirming chain…'
                      : isContractPending
                        ? 'Wallet…'
                        : 'Creating...'
                    : escrowEnabled && useEscrow
                      ? 'Raise PO + on-chain escrow'
                      : 'Raise purchase order'}
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
                    const isOnchain = po.onchain_po_id != null && po.onchain_po_id !== '';
                    return (
                      <div
                        key={po.id}
                        className="border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="font-semibold text-lg">
                              PO #{po.id} · {supplierLabel}
                            </div>
                            {po.description && (
                              <div className="text-neutral-600 text-sm mt-0.5">{po.description}</div>
                            )}
                            {escrowEnabled && (
                              <div className="text-xs mt-1">
                                {isOnchain ? (
                                  <span className="text-emerald-600 font-medium">
                                    On-chain escrow ID: {po.onchain_po_id}
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium">
                                    Standard PO (no on-chain escrow yet)
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-xs text-neutral-400 mt-1">
                              {po.created_at
                                ? new Date(po.created_at).toLocaleString()
                                : ''}
                            </div>
                            {Array.isArray(po.items) && po.items.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                                {po.items.slice(0, 6).map((it, idx) => (
                                  <li
                                    key={`${po.id}-line-${idx}`}
                                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                                  >
                                    <span className="font-medium text-slate-700">
                                      {it.item_name || 'Line'}
                                    </span>
                                    <span className="text-neutral-400">
                                      × {it.quantity}
                                      {it.uom ? ` ${it.uom}` : ''}
                                    </span>
                                    {it.public_id ? (
                                      <a
                                        href={`/p/${it.public_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-700 font-semibold underline-offset-2 hover:underline"
                                        title="Open product passport"
                                      >
                                        Passport
                                      </a>
                                    ) : null}
                                  </li>
                                ))}
                                {po.items.length > 6 ? (
                                  <li className="text-neutral-400">
                                    +{po.items.length - 6} more lines
                                  </li>
                                ) : null}
                              </ul>
                            ) : null}
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
                                disabled={busy}
                                onClick={() => handleCancel(po.id)}
                                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>

                        {escrowEnabled && (
                          <div className="flex flex-wrap gap-2">
                            {isOnchain &&
                              po.status !== 'funded' &&
                              po.status !== 'paid' &&
                              po.status !== 'completed' &&
                              po.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => fundOnchainPO(po)}
                                  className="px-4 py-1.5 bg-[#00b4d8] text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:bg-neutral-300"
                                >
                                  <Wallet className="w-3.5 h-3.5" /> Fund on-chain escrow
                                </button>
                              )}
                            {!isOnchain && po.status !== 'cancelled' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => createOnchainEscrowForPo(po)}
                                className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:bg-neutral-300"
                              >
                                <Wallet className="w-3.5 h-3.5" /> Create on-chain escrow
                              </button>
                            )}
                            {isOnchain &&
                              (po.status === 'funded' || po.status === 'paid') && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => confirmDeliveryOnchain(po)}
                                  className="px-4 py-1.5 bg-violet-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:bg-neutral-300"
                                  title="Pays supplier after markShipped"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Confirm delivery & pay
                                </button>
                              )}
                            {po.onchain_tx && (
                              <span className="px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-xl flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Chain tx verified
                              </span>
                            )}
                          </div>
                        )}
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
