'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AddContainerForm from '@/components/AddContainerForm';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function AddContainerPage() {
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
    <div className="px-4 md:px-8 py-8 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <Link
        href="/dashboard/containers/manage"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to manage containers
      </Link>

      <h1 className="font-black text-4xl md:text-5xl tracking-[-2px] text-[#00b4d8] mb-3">
        Add New Container
      </h1>
      <p className="text-lg text-neutral-600 mb-8 max-w-2xl">
        Onboard a retail container outlet and assign an independent contractor.
      </p>

      {open ? (
        <AddContainerForm onClose={handleClose} onSuccess={handleSuccess} />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center text-neutral-500">
          Redirecting…
        </div>
      )}
    </div>
  );
}
