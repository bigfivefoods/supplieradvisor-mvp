'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { syncConnectionToDatabase, type ConnectionStatus } from '@/app/actions/connections';

type ConnectionButtonProps = {
  currentProfileId: number;
  targetProfileId: number;
  targetWalletAddress?: `0x${string}`;
  currentStatus?: ConnectionStatus;
  onSuccess?: () => void;
};

export function ConnectionButton({
  currentProfileId,
  targetProfileId,
  currentStatus = 'none',
  onSuccess,
}: ConnectionButtonProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<ConnectionStatus>(currentStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    setOptimisticStatus('pending');

    const toastId = toast.loading('Sending connection request...');

    try {
      const result = await syncConnectionToDatabase({
        profileIdA: currentProfileId,
        profileIdB: targetProfileId,
        status: 'pending',
        initiatedBy: currentProfileId,
      });

      if (result.success) {
        toast.success('Connection request sent!', {
          id: toastId,
          description: 'The company has been notified.',
        });
        onSuccess?.();
      } else {
        toast.error(result.error || 'Failed to send request', { id: toastId });
        setOptimisticStatus(currentStatus);
      }
    } catch (err: any) {
      console.error('Connection failed:', err);
      toast.error('Failed to send connection request', { id: toastId });
      setOptimisticStatus(currentStatus);
    } finally {
      setIsLoading(false);
    }
  };

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
        Request Pending
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? 'Sending request...' : 'Connect with this Company'}
    </button>
  );
}