'use client';

/**
 * Raise on-chain dispute (POEscrowV2 / USDC when funded/shipped).
 */
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { Loader2, Gavel } from 'lucide-react';
import POEscrowV2ABI from '@/lib/contracts/abi/POEscrowV2.json';
import {
  getPoEscrowAddress,
  getPoEscrowChainId,
  isEscrowConfigured,
} from '@/lib/contracts/escrow';
import {
  PO_ESCROW_USDC_ABI,
  getUsdcEscrowAddress,
  getUsdcEscrowChainId,
  isUsdcEscrowConfigured,
} from '@/lib/contracts/usdcEscrow';

type Props = {
  onchainPoId: string | number;
  mode?: 'eth' | 'usdc' | 'unknown';
  onDisputed?: (txHash: string) => void;
};

export default function EscrowDisputeButton({
  onchainPoId,
  mode = 'eth',
  onDisputed,
}: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [reason, setReason] = useState('Delivery or quality dispute');
  const [open, setOpen] = useState(false);

  const useUsdc = mode === 'usdc' && isUsdcEscrowConfigured();
  const ethOk = isEscrowConfigured();
  if (!useUsdc && !ethOk) return null;

  const requiredId = useUsdc ? getUsdcEscrowChainId() : getPoEscrowChainId();
  const address = useUsdc ? getUsdcEscrowAddress() : getPoEscrowAddress();
  const abi = useUsdc ? PO_ESCROW_USDC_ABI : (POEscrowV2ABI.abi as readonly unknown[]);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess && txHash && open) {
    toast.success('Dispute submitted on-chain');
    onDisputed?.(txHash);
    setOpen(false);
  }

  const submit = () => {
    if (!isConnected) {
      toast.error('Connect wallet');
      return;
    }
    if (chainId !== requiredId && switchChain) {
      switchChain({ chainId: requiredId });
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason required');
      return;
    }
    writeContract(
      {
        address: address as `0x${string}`,
        abi: abi as any,
        functionName: 'raiseDispute',
        args: [BigInt(String(onchainPoId)), reason.trim().slice(0, 200)],
        chainId: requiredId,
      },
      {
        onError: (e) => toast.error(e.message || 'Dispute failed'),
      }
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary !py-1.5 !px-3 text-xs border-rose-200 text-rose-800 inline-flex items-center gap-1"
      >
        <Gavel className="w-3 h-3" /> Dispute
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 space-y-2 min-w-[200px]">
      <input
        className="input !py-1.5 !text-xs w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Dispute reason"
      />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={isPending || confirming}
          onClick={submit}
          className="btn-primary !py-1 !px-2 text-xs bg-rose-600 border-rose-600"
        >
          {isPending || confirming ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Submit on-chain'
          )}
        </button>
        <button
          type="button"
          className="text-xs text-neutral-500 underline"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
