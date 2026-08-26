'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Factory,
  Leaf,
  ShoppingBag,
  Truck,
  Landmark,
  Building2,
  Dumbbell,
  Stethoscope,
  Smile,
  BrainCircuit,
  Hospital,
  Mountain,
  Store,
  BriefcaseBusiness,
  Container,
  PawPrint,
  type LucideIcon,
} from 'lucide-react';
import {
  INDUSTRIES as CATALOGUE,
  type IndustrySlug,
} from '@/lib/marketing/industries';

const ICONS: Record<IndustrySlug, LucideIcon> = {
  'food-beverage': ShoppingBag,
  agriculture: Leaf,
  'quarry-aggregates': Mountain,
  manufacturing: Factory,
  distribution: Truck,
  containers: Container,
  'fitness-gyms': Dumbbell,
  'physio-allied-health': Stethoscope,
  dental: Smile,
  'mental-health': BrainCircuit,
  'medical-practices': Hospital,
  'veterinary-practices': PawPrint,
  'hire-rental': BriefcaseBusiness,
  'retail-shop': Store,
  'public-sector': Landmark,
  'multi-entity': Building2,
  'staffing-recruitment': BriefcaseBusiness,
};

const HIDE = new Set<IndustrySlug>(['staffing-recruitment']);

const INDUSTRIES = CATALOGUE.filter((i) => !HIDE.has(i.slug)).map((i) => ({
  slug: i.slug,
  name: i.name,
  desc: i.cardBlurb || i.subhead,
  icon: ICONS[i.slug] || Building2,
}));

export default function IndustriesStrip() {
  return (
    <section
      id="industries"
      className="sa-anchor border-t border-slate-200 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
            Industries
          </p>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
            One OS. Sector-ready depth.
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Same platform fabric — Core OS, Industry Advisors (CropAdvisor®,
            QuarryAdvisor®, GymAdvisor®, PhysioAdvisor®, DentalAdvisor®,
            PsychiatryAdvisor®, MedicalAdvisor®, VetAdvisor®, HireAdvisor®,
            RetailAdvisor®, ContainerAdvisor®), and government programmes
            (SchoolAdvisor® · HealthAdvisor®). Exclusive diaries &amp; rooms,
            industry PWAs, waitlist desks, kitchens, and marketplace — SA bills
            the company subscription, not member or patient fees.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="group rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-sky-50/30 p-6 shadow-sm transition-all hover:border-[#00b4d8]/45 hover:shadow-md"
            >
              <ind.icon className="mb-3 h-5 w-5 text-[#00b4d8]" />
              <h3 className="text-lg font-black text-slate-900 group-hover:text-[#0077b6]">
                {ind.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {ind.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#00b4d8]">
                Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
