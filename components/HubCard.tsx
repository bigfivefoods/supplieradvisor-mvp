'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface HubCardProps {
  title: string;
  description?: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
}

export default function HubCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  badge 
}: HubCardProps) {
  return (
    <Link 
      href={href}
      className="group block bg-white border border-neutral-200 rounded-3xl p-6 md:p-7 hover:border-[#00b4d8] hover:shadow-md transition-all active:scale-[0.985]"
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="flex-shrink-0 p-3 bg-neutral-100 rounded-2xl group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
            <Icon className="w-6 h-6" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-xl tracking-tight group-hover:text-[#00b4d8] transition-colors">
              {title}
            </h3>
            {badge && (
              <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                {badge}
              </span>
            )}
          </div>
          
          {description && (
            <p className="text-neutral-600 mt-2 text-[15px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}