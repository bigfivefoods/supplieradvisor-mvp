'use client';

import Link from 'next/link';
import {
  Building2,
  ClipboardList,
  HeartPulse,
  Landmark,
  Loader2,
  MapPinned,
  UtensilsCrossed,
} from 'lucide-react';
import {
  CompanyRequired,
  HealthHeader,
  HealthPage,
} from '@/components/health/HealthShell';
import { useHealthProgrammeRole } from '@/lib/health/useProgrammeRole';

export default function HealthHomePage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const programme = useHealthProgrammeRole();

  if (programme.loading) {
    return (
      <HealthPage>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      </HealthPage>
    );
  }

  if (programme.role === 'department') {
    return (
      <HealthPage>
        <HealthHeader
          title="Department of Health"
          titleAccent="Programme desk"
          mode="agency"
          description="DoH → SPs → clinics & hospitals. Approve facilities and service providers, publish approved foods, and track nutrition."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              href: '/dashboard/health/agency',
              label: 'DoH desk',
              desc: 'Register department · approve facilities & SPs',
              icon: Landmark,
            },
            {
              href: '/dashboard/health/join',
              label: 'Join & add',
              desc: 'Add clinics, hospitals and SPs',
              icon: Building2,
            },
            {
              href: '/dashboard/health/facilities',
              label: 'Facilities',
              desc: 'All clinics & hospitals on your programme',
              icon: HeartPulse,
            },
            {
              href: '/dashboard/health/report',
              label: 'Coverage report',
              desc: 'Counts by district · member type',
              icon: ClipboardList,
            },
            {
              href: '/dashboard/schools/approved-list',
              label: 'Approved foods',
              desc: 'Catalogue facilities may order',
              icon: UtensilsCrossed,
            },
            {
              href: '/dashboard/health/map',
              label: 'Map',
              desc: 'Facility locations',
              icon: MapPinned,
            },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="rounded-3xl border border-rose-100 bg-white p-5 hover:border-rose-300 hover:shadow-md transition-all"
            >
              <x.icon className="w-5 h-5 text-rose-600 mb-2" />
              <p className="font-black text-slate-900">{x.label}</p>
              <p className="text-xs text-slate-500 mt-1">{x.desc}</p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Education (DBE / schools / NSNP) is a separate module under{' '}
          <Link href="/dashboard/schools" className="font-bold text-[#0077b6]">
            Schools
          </Link>
          .
        </p>
      </HealthPage>
    );
  }

  if (programme.role === 'sp') {
    return (
      <HealthPage>
        <HealthHeader
          title="Health supply"
          titleAccent="Service provider"
          mode="isp"
          description="Join Department of Health, then supply approved foods to clinics and hospitals under DoH."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/health/join"
            className="rounded-3xl border border-amber-200 bg-white p-5 hover:shadow-md"
          >
            <p className="font-black">Join DoH</p>
            <p className="text-xs text-slate-500 mt-1">
              Request association with Department of Health
            </p>
          </Link>
          <Link
            href="/dashboard/schools/deliveries"
            className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md"
          >
            <p className="font-black">Deliveries</p>
            <p className="text-xs text-slate-500 mt-1">
              Dispatch and POD for health facilities
            </p>
          </Link>
        </div>
      </HealthPage>
    );
  }

  return (
    <HealthPage>
      <HealthHeader
        title="Clinic / hospital"
        titleAccent="Facility"
        mode="facility"
        description="Join Department of Health, order approved foods from DoH-approved SPs, and log meal service."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            href: '/dashboard/health/join',
            label: 'Join DoH',
            desc: 'Request to join Department of Health',
          },
          {
            href: '/dashboard/schools/profile',
            label: 'Facility profile',
            desc: 'Name, type (clinic/hospital), kitchen',
          },
          {
            href: '/dashboard/schools/approved-list',
            label: 'Approved foods',
            desc: 'What you may order',
          },
          {
            href: '/dashboard/schools/orders',
            label: 'Orders',
            desc: 'Purchase from approved SPs',
          },
          {
            href: '/dashboard/schools/kitchen',
            label: 'Kitchen',
            desc: 'GRN · issue · waste',
          },
          {
            href: '/dashboard/schools/nutrition',
            label: 'Nutrition',
            desc: 'Meal nutrition vs norms',
          },
        ].map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className="rounded-3xl border border-slate-200 bg-white p-5 hover:border-rose-200 hover:shadow-md"
          >
            <p className="font-black text-slate-900">{x.label}</p>
            <p className="text-xs text-slate-500 mt-1">{x.desc}</p>
          </Link>
        ))}
      </div>
    </HealthPage>
  );
}
