'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface ModuleHubProps {
  title: string;
  description?: string;
  backHref?: string;
  children: ReactNode;
}

export default function ModuleHub({ 
  title, 
  description, 
  backHref = '/dashboard', 
  children 
}: ModuleHubProps) {
  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      {/* Back Navigation */}
      {backHref && (
        <Link 
          href={backHref} 
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      )}

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-black text-4xl md:text-5xl lg:text-6xl tracking-[-2.5px] text-[#00b4d8] mb-3">
          {title}
        </h1>
        
        {description && (
          <p className="text-lg md:text-xl text-neutral-600 max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}