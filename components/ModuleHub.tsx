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
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        {backHref && (
          <Link 
            href={backHref} 
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        )}
        
        <h1 className="font-black text-5xl tracking-[-1.5px] mb-3">{title}</h1>
        
        {description && (
          <p className="text-xl text-neutral-600 max-w-2xl">{description}</p>
        )}
      </div>

      {/* Content Area */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}