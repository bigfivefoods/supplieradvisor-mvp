'use client';

import { CreditorBookView } from '@/components/recovery/book-views';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';

export default function RecoverCreditorDetailPage() {
  const { desk, loading, error } = useRecoverDesk();
  return (
    <CreditorBookView
      phase={loading ? 'loading' : error ? 'error' : 'ready'}
      creditors={desk?.creditors || []}
      mandates={desk?.mandates || []}
    />
  );
}
