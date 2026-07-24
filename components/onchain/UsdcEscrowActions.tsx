'use client';

/**
 * USDC (Base) escrow actions for POEscrowUSDC.
 * Flow: approve USDC → createPO → auto-parse PO_Created → fundPO.
 */
import { useEffect, useRef, useState } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
  useChainId,
  usePublicClient,
} from 'wagmi';
import { parseEventLogs } from 'viem';
import { toast } from 'sonner';
import { Loader2, Coins } from 'lucide-react';
import {
  ERC20_ABI,
  PO_ESCROW_USDC_ABI,
  getUsdcEscrowAddress,
  getUsdcTokenAddress,
  getUsdcEscrowChainId,
  getUsdcEscrowChain,
  isUsdcEscrowConfigured,
  fiatToUsdcUnits,
  usdcUnitsToDisplay,
} from '@/lib/contracts/usdcEscrow';

type Props = {
  supplierWallet: string;
  fiatAmount: number;
  /** ZAR per 1 USD for demo conversion when PO is in ZAR */
  fiatPerUsd?: number;
  metadataURI: string;
  onCreated?: (args: {
    onchainPoId: string;
    txHash: string;
    amountUnits: string;
  }) => void;
  onFunded?: (args: { onchainPoId: string; txHash: string }) => void;
};

export default function UsdcEscrowActions({
  supplierWallet,
  fiatAmount,
  fiatPerUsd = 18,
  metadataURI,
  onCreated,
  onFunded,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const requiredId = getUsdcEscrowChainId();
  const chain = getUsdcEscrowChain();
  const escrow = getUsdcEscrowAddress();
  const token = getUsdcTokenAddress();
  const amountUnits = fiatToUsdcUnits(fiatAmount, { fiatPerUsd });

  const [onchainPoId, setOnchainPoId] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approve' | 'create' | 'fund'>('idle');
  const parsedCreate = useRef<string | null>(null);
  const fundedTx = useRef<string | null>(null);

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && escrow ? [address, escrow] : undefined,
    query: { enabled: Boolean(address && escrow) },
  });

  // Auto-parse create receipt → set poId + callback
  useEffect(() => {
    if (!isSuccess || !txHash || step !== 'create' || onchainPoId) return;
    if (parsedCreate.current === txHash) return;
    parsedCreate.current = txHash;

    let cancelled = false;
    (async () => {
      try {
        let client = publicClient;
        if (!client) {
          const { createPublicClient, http } = await import('viem');
          client = createPublicClient({
            chain,
            transport: http(
              process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
                process.env.NEXT_PUBLIC_BASE_RPC ||
                'https://sepolia.base.org'
            ),
          });
        }
        const receipt = await client.getTransactionReceipt({ hash: txHash });
        const logs = parseEventLogs({
          abi: PO_ESCROW_USDC_ABI,
          eventName: 'PO_Created',
          logs: receipt.logs,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poId = String((logs[0] as any)?.args?.poId ?? '');
        if (!poId || cancelled) {
          if (!poId) toast.error('Could not parse PO_Created — try again');
          return;
        }
        setOnchainPoId(poId);
        onCreated?.({
          onchainPoId: poId,
          txHash,
          amountUnits: amountUnits.toString(),
        });
        toast.success(`USDC escrow created · chain PO #${poId}`);
        void refetchAllowance();
        reset();
        setStep('idle');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Parse create failed');
        setStep('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isSuccess,
    txHash,
    step,
    onchainPoId,
    publicClient,
    chain,
    amountUnits,
    onCreated,
    refetchAllowance,
    reset,
  ]);

  // Auto-confirm fund
  useEffect(() => {
    if (!isSuccess || !txHash || step !== 'fund' || !onchainPoId) return;
    if (fundedTx.current === txHash) return;
    fundedTx.current = txHash;
    onFunded?.({ onchainPoId, txHash });
    toast.success('USDC fund confirmed');
    reset();
    setStep('idle');
  }, [isSuccess, txHash, step, onchainPoId, onFunded, reset]);

  if (!isUsdcEscrowConfigured() || !escrow) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        USDC escrow not configured. Deploy <code>POEscrowUSDC.sol</code> on Base
        Sepolia and set <code>NEXT_PUBLIC_USDC_ESCROW_ADDRESS</code>.
      </div>
    );
  }

  const wrongChain = isConnected && chainId !== requiredId;
  const needsApprove =
    allowance == null || (allowance as bigint) < amountUnits;

  const ensureChain = () => {
    if (wrongChain && switchChain) {
      switchChain({ chainId: requiredId });
      return false;
    }
    return true;
  };

  const approve = () => {
    if (!ensureChain() || !address) return;
    setStep('approve');
    writeContract(
      {
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [escrow, amountUnits],
        chainId: requiredId,
      },
      {
        onError: (e) => {
          toast.error(e.message || 'Approve failed');
          setStep('idle');
        },
        onSuccess: () => toast.message('Approve USDC submitted…'),
      }
    );
  };

  const create = () => {
    if (!ensureChain() || !/^0x[a-fA-F0-9]{40}$/.test(supplierWallet)) {
      toast.error('Valid supplier wallet required');
      return;
    }
    setStep('create');
    parsedCreate.current = null;
    writeContract(
      {
        address: escrow,
        abi: PO_ESCROW_USDC_ABI,
        functionName: 'createPO',
        args: [supplierWallet as `0x${string}`, amountUnits, metadataURI],
        chainId: requiredId,
      },
      {
        onError: (e) => {
          toast.error(e.message || 'createPO failed');
          setStep('idle');
        },
      }
    );
  };

  const fund = () => {
    if (!onchainPoId) {
      toast.error('Create on-chain PO first');
      return;
    }
    if (!ensureChain()) return;
    if (needsApprove) {
      toast.error('Approve USDC first');
      return;
    }
    setStep('fund');
    fundedTx.current = null;
    writeContract(
      {
        address: escrow,
        abi: PO_ESCROW_USDC_ABI,
        functionName: 'fundPO',
        args: [BigInt(onchainPoId)],
        chainId: requiredId,
      },
      {
        onError: (e) => {
          toast.error(e.message || 'fundPO failed');
          setStep('idle');
        },
      }
    );
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Coins className="w-4 h-4 text-violet-600" />
        USDC escrow · {chain.name}
      </div>
      <p className="text-xs text-neutral-600">
        Amount ≈ {usdcUnitsToDisplay(amountUnits)} USDC (
        {amountUnits.toString()} base units) from PO total @ R{fiatPerUsd}/USD demo
        FX. Approve → create (auto-parses chain id) → fund.
        {onchainPoId ? ` Chain PO #${onchainPoId}.` : ''}
      </p>
      {wrongChain && (
        <button
          type="button"
          onClick={() => switchChain?.({ chainId: requiredId })}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500 text-white"
        >
          Switch to {chain.name}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!isConnected || isPending || confirming}
          onClick={approve}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          {step === 'approve' && (isPending || confirming) ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            '1. Approve USDC'
          )}
        </button>
        <button
          type="button"
          disabled={!isConnected || isPending || confirming}
          onClick={create}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          {step === 'create' && (isPending || confirming) ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            '2. createPO'
          )}
        </button>
        <button
          type="button"
          disabled={!isConnected || isPending || confirming || !onchainPoId}
          onClick={fund}
          className="btn-primary !py-1.5 !px-3 text-xs"
        >
          {step === 'fund' && (isPending || confirming) ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            '3. fundPO'
          )}
        </button>
      </div>
    </div>
  );
}
