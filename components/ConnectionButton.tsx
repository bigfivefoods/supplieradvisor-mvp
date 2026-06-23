'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { syncConnectionToDatabase, type ConnectionStatus } from '@/app/actions/connections';
import { CompanyConnectionRegistryABI } from '@/lib/abis/CompanyConnectionRegistry';

type ConnectionButtonProps = {
  currentProfileId: number;
  targetProfileId: number;
  targetWalletAddress: `0x${string}`;
  currentStatus?: ConnectionStatus;
  onSuccess?: () => void;
};

export function ConnectionButton({
  currentProfileId,
  targetProfileId,
  targetWalletAddress,
  currentStatus = 'none',
  onSuccess,
}: ConnectionButtonProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<ConnectionStatus>(currentStatus);

  const { 
    writeContractAsync, 
    data: txHash, 
    isPending: isSendingTx,
    reset 
  } = useWriteContract();

  const { 
    isLoading: isConfirmingTx, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isLoading = isSendingTx || isConfirmingTx;

  // Update optimistic status when transaction is confirmed onchain
  if (isConfirmed && optimisticStatus === 'none') {
    setOptimisticStatus('pending');
  }

  const handleConnect = async () => {
    if (!targetWalletAddress) {
      toast.error('Target wallet address is missing');
      return;
    }

    // Optimistic UI update
    setOptimisticStatus('pending');

    // Create a persistent loading toast
    const toastId = toast.loading('Sending connection request...', {
      description: 'Please confirm the transaction in your wallet',
    });

    try {
      // 1. Send the onchain transaction
      const hash = await writeContractAsync({
        address: '0xYourContractAddressHere', // ← Replace with real contract
        abi: CompanyConnectionRegistryABI,
        functionName: 'requestConnection',
        args: [targetWalletAddress],
      });

      // Update toast while waiting for confirmation
      toast.loading('Confirming transaction on Base...', {
        id: toastId,
        description: 'Waiting for blockchain confirmation',
      });

      // 2. Sync to Supabase database
      const result = await syncConnectionToDatabase({
        profileIdA: currentProfileId,
        profileIdB: targetProfileId,
        status: 'pending',
        initiatedBy: currentProfileId,
        txHash: hash,
      });

      if (result.success) {
        // Success toast with link to explorer
        toast.success('Connection request sent!', {
          id: toastId,
          description: 'The company has been notified.',
          action: {
            label: 'View Transaction',
            onClick: () =>
              window.open(`https://sepolia.basescan.org/tx/${hash}`, '_blank'),
          },
        });

        onSuccess?.();
      } else {
        toast.error(result.error || 'Failed to save connection', { id: toastId });
        setOptimisticStatus(currentStatus); // Revert optimistic state
      }
    } catch (err: any) {
      console.error('Connection failed:', err);

      let message = 'Failed to send connection request';
      if (err?.shortMessage) message = err.shortMessage;
      else if (err?.message?.includes('User rejected')) message = 'Transaction was rejected';

      toast.error(message, { id: toastId });
      setOptimisticStatus(currentStatus); // Revert optimistic state
      reset();
    }
  };

  // ==================== RENDER DIFFERENT STATES ====================

  if (optimisticStatus === 'connected') {
    return (
      <button 
        disabled 
        className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-default flex items-center gap-2"
      >
        ✓ Connected
      </button>
    );
  }

  if (optimisticStatus === 'pending') {
    return (
      <button 
        disabled 
        className="px-4 py-2 bg-yellow-500 text-white rounded-lg cursor-default"
      >
        {isLoading ? 'Confirming onchain...' : 'Request Pending'}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {isSendingTx && 'Sending transaction...'}
      {isConfirmingTx && 'Confirming onchain...'}
      {!isLoading && 'Connect with this Company'}
    </button>
  );
}