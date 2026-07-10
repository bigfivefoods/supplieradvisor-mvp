'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddContainerForm from '@/components/AddContainerForm';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

export default function AddContainerPage() {
  return (
    <CompanyRequired>
      <AddInner />
    </CompanyRequired>
  );
}

function AddInner() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push('/dashboard/containers/manage');
  };

  const handleSuccess = () => {
    router.push('/dashboard/containers/manage');
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Add"
        titleAccent="container"
        description="Onboard a retail container outlet and assign an independent contractor."
        action={
          <Link href="/dashboard/containers/manage" className="btn-secondary !py-2.5 !px-5 text-sm">
            Back to manage
          </Link>
        }
      />

      {open ? (
        <AddContainerForm onClose={handleClose} onSuccess={handleSuccess} />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center text-neutral-500 text-sm">
          Redirecting…
        </div>
      )}
    </ContainersPage>
  );
}
