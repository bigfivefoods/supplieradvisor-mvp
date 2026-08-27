'use client';

/**
 * Onboarding: Account → Sector → Industry → Business type → Details → Review
 * Clear selection trail; packs follow industry; entity type from business type.
 */
import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Layers,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import { resolveEntityKind } from '@/lib/entities/entity-kinds';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
  OS_SECTORS,
  getIndustryPack,
  getOsEntityType,
  monthlyPriceZar,
  type OsSectorId,
} from '@/lib/product/architecture';
import {
  getBusinessType,
  getIndustry,
  industriesForSector,
  sectorLabel,
} from '@/lib/product/business-catalogue';
import { B2B_ORG_TYPES } from '@/lib/product/org-types';

const B2B_STEPS = [
  'Account',
  'Org type',
  'Sector',
  'Industry',
  'Business type',
  'Details',
  'Review',
] as const;

const B2G_STEPS = ['Account', 'Government', 'Details', 'Review'] as const;

const B2G_ORG_TYPES = [
  {
    id: 'national',
    label: 'National department',
    description: 'National government department or agency.',
    entityTypeId: 'national',
    businessType: 'national_government',
  },
  {
    id: 'provincial',
    label: 'Provincial department',
    description: 'Provincial department, including most PEU offices.',
    entityTypeId: 'provincial',
    businessType: 'provincial_government',
  },
  {
    id: 'municipal',
    label: 'Municipal / local government',
    description: 'Municipality, metro or local government office.',
    entityTypeId: 'municipal',
    businessType: 'municipal_government',
  },
  {
    id: 'government_education',
    label: 'Department of Education (DBE / PEU)',
    description: 'Education programme office — catalogue, schools, claims.',
    entityTypeId: 'provincial',
    businessType: 'government_education',
  },
  {
    id: 'government_health',
    label: 'Department of Health',
    description: 'Health programme office — facilities and approved suppliers.',
    entityTypeId: 'provincial',
    businessType: 'government_health',
  },
] as const;

type FormState = {
  os_sector: string;
  /** Multi industry catalogue ids */
  os_industries: string[];
  os_business_types: string[];
  os_entity_type: string;
  legal_form: string;
  join_lane: 'b2b' | 'b2g';
  industry_packs: string[];
  industry_modules: string[];
  business_type: string;
  trading_name: string;
  legal_name: string;
  registration_number: string;
  industry: string;
  country: string;
  city: string;
  website: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  short_description: string;
};

function mapTypeParamToSector(typeParam: string): string {
  const t = typeParam.toLowerCase();
  if (t === 'school' || t === 'education' || t === 'government' || t === 'gov' || t === 'dbe' || t === 'provincial' || t === 'national' || t === 'municipal') {
    return 'public_sector';
  }
  return '';
}

function mapTypeParamToIndustry(typeParam: string): string {
  const t = typeParam.toLowerCase();
  if (t === 'school' || t === 'education') return 'public_local';
  if (t === 'dbe' || t === 'provincial') return 'public_provincial';
  if (t === 'national') return 'public_national';
  if (t === 'municipal' || t === 'government' || t === 'gov') return 'public_municipal';
  return '';
}

export default function BusinessOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || 'business';
  const laneParam = String(searchParams.get('lane') || '').toLowerCase();
  const isGovType =
    /government|gov|dbe|peu|national|provincial|municipal|doh/.test(
      typeParam.toLowerCase()
    );
  const joinLane: 'b2b' | 'b2g' =
    laneParam === 'b2g' || isGovType ? 'b2g' : 'b2b';
  const STEPS = joinLane === 'b2g' ? B2G_STEPS : B2B_STEPS;
  const claimId = Number(searchParams.get('claim') || 0) || null;
  const claimName = searchParams.get('name') || '';
  const prefillEmail = searchParams.get('email') || '';
  const { ready, authenticated, user, login } = usePrivy();

  const initialSector = mapTypeParamToSector(typeParam);
  const initialIndustry = mapTypeParamToIndustry(typeParam);

  const [step, setStep] = useState(0);
  const current = STEPS[step] || 'Account';
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneProfileId, setDoneProfileId] = useState<number | null>(null);
  const [doneLifetime, setDoneLifetime] = useState(false);
  const [doneContactRequired, setDoneContactRequired] = useState(false);
  const [claimConflict, setClaimConflict] = useState<{
    profileId: number;
    connectHref?: string;
  } | null>(null);
  const [form, setForm] = useState<FormState>({
    os_sector: initialSector,
    os_industries: initialIndustry ? [initialIndustry] : [],
    os_business_types: [],
    os_entity_type: joinLane === 'b2g' ? 'national' : 'private_company',
    legal_form: '',
    join_lane: joinLane,
    industry_packs: initialIndustry
      ? [...(getIndustry(initialIndustry)?.packIds || [])]
      : [],
    industry_modules: [],
    business_type: joinLane === 'b2g' ? 'national_government' : 'business',
    trading_name: claimName || '',
    legal_name: claimName || '',
    registration_number: '',
    industry: '',
    country: 'South Africa',
    city: '',
    website: '',
    contact_name: '',
    contact_email: prefillEmail || '',
    contact_phone: '',
    short_description: '',
  });

  const sectorDef = useMemo(
    () => OS_SECTORS.find((s) => s.id === form.os_sector) || null,
    [form.os_sector]
  );
  const industryDefs = useMemo(
    () =>
      form.os_industries
        .map((id) => getIndustry(id))
        .filter(Boolean) as NonNullable<ReturnType<typeof getIndustry>>[],
    [form.os_industries]
  );
  const industryDef = industryDefs[0] || null;
  const businessTypeDef = useMemo(() => {
    for (const ind of industryDefs) {
      for (const btid of form.os_business_types) {
        const bt = getBusinessType(ind.id, btid);
        if (bt) return bt;
      }
    }
    return null;
  }, [industryDefs, form.os_business_types]);
  const entityDef = getOsEntityType(form.os_entity_type);
  const contactRequired = entityDef?.setupPath === 'contact_required';

  const industries = useMemo(
    () => industriesForSector(form.os_sector),
    [form.os_sector]
  );

  const price = useMemo(
    () => monthlyPriceZar(form.industry_packs),
    [form.industry_packs]
  );

  const progress = ((step + 1) / STEPS.length) * 100;

  const canNext = useMemo(() => {
    if (current === 'Account') return authenticated;
    if (current === 'Org type') return Boolean(form.legal_form);
    if (current === 'Government') return Boolean(form.legal_form);
    if (current === 'Sector') return Boolean(form.os_sector);
    if (current === 'Industry') return form.os_industries.length > 0;
    if (current === 'Business type') return form.os_business_types.length > 0;
    if (current === 'Details') {
      return (
        form.trading_name.trim().length >= 2 &&
        form.contact_name.trim().length >= 2 &&
        form.contact_email.includes('@')
      );
    }
    return true;
  }, [current, authenticated, form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectOrgType = (
    row:
      | (typeof B2B_ORG_TYPES)[number]
      | (typeof B2G_ORG_TYPES)[number]
  ) => {
    setForm((prev) => ({
      ...prev,
      legal_form: row.id,
      os_entity_type: row.entityTypeId,
      business_type: row.businessType,
      os_sector:
        form.join_lane === 'b2g' ? 'public_sector' : prev.os_sector,
    }));
  };

  const selectSector = (sectorId: OsSectorId) => {
    setForm((prev) => ({
      ...prev,
      os_sector: sectorId,
      os_industries: [],
      os_business_types: [],
      industry_packs: [],
      industry_modules: [],
      os_entity_type:
        sectorId === 'public_sector' ? 'municipal' : 'private_company',
      business_type: sectorId === 'public_sector' ? 'municipal_government' : 'business',
      industry: '',
    }));
  };

  const toggleIndustry = (industryId: string) => {
    setForm((prev) => {
      const has = prev.os_industries.includes(industryId);
      const os_industries = has
        ? prev.os_industries.filter((id) => id !== industryId)
        : [...prev.os_industries, industryId];
      const packs = [
        ...new Set(
          os_industries.flatMap((id) => getIndustry(id)?.packIds || [])
        ),
      ];
      const labels = os_industries
        .map((id) => getIndustry(id)?.label)
        .filter(Boolean);
      const os_business_types = prev.os_business_types.filter((btid) =>
        os_industries.some((iid) => Boolean(getBusinessType(iid, btid)))
      );
      return {
        ...prev,
        os_industries,
        os_business_types,
        industry_packs: packs,
        industry_modules: [],
        industry: labels.join(', '),
      };
    });
  };

  const toggleBusinessType = (businessTypeId: string) => {
    setForm((prev) => {
      const has = prev.os_business_types.includes(businessTypeId);
      const os_business_types = has
        ? prev.os_business_types.filter((id) => id !== businessTypeId)
        : [...prev.os_business_types, businessTypeId];
      let os_entity_type = prev.os_entity_type;
      let business_type = prev.business_type;
      for (const iid of prev.os_industries) {
        for (const btid of os_business_types) {
          const bt = getBusinessType(iid, btid);
          if (bt) {
            os_entity_type = bt.entityTypeId;
            business_type = bt.profileBusinessType;
            break;
          }
        }
      }
      return { ...prev, os_business_types, os_entity_type, business_type };
    });
  };

  const ensureAuthPrefill = () => {
    if (!user) return;
    const email = extractEmailFromPrivyUser(user);
    if (email && !form.contact_email) {
      update('contact_email', email);
    }
  };

  const goNext = () => {
    if (current === 'Account' && !authenticated) {
      login();
      return;
    }
    if (current === 'Account') ensureAuthPrefill();
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!authenticated || !user) {
      login();
      return;
    }
    const privyUserId = getCanonicalUserId(user.id);
    if (!privyUserId) {
      toast.error('Session not ready. Please sign in again.');
      return;
    }

    const entity = getOsEntityType(form.os_entity_type);
    const requiresApproval = form.join_lane === 'b2g';
    let bt = null as ReturnType<typeof getBusinessType>;
    for (const iid of form.os_industries) {
      for (const btid of form.os_business_types) {
        bt = getBusinessType(iid, btid);
        if (bt) break;
      }
      if (bt) break;
    }
    const business_type =
      bt?.profileBusinessType || entity?.businessType || form.business_type || 'business';

    setSubmitting(true);
    try {
      let referralCode =
        searchParams.get('ref') || searchParams.get('referral') || null;
      if (referralCode && typeof window !== 'undefined') {
        try {
          localStorage.setItem('sa_referral_code', referralCode);
        } catch {
          /* ignore */
        }
      } else if (typeof window !== 'undefined') {
        try {
          referralCode = localStorage.getItem('sa_referral_code');
        } catch {
          /* ignore */
        }
      }

      const res = await fetch('/api/onboarding/register-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId,
          business_type,
          trading_name: form.trading_name,
          legal_name: form.legal_name,
          registration_number: form.registration_number,
          industry:
            industryDefs.map((i) => i.label).join(', ') ||
            form.industry ||
            form.os_sector,
          industries: industryDefs.map((i) => i.label),
          country: form.country,
          city: form.city,
          website: form.website,
          contact_name: form.contact_name,
          contact_email:
            form.contact_email || extractEmailFromPrivyUser(user),
          contact_phone: form.contact_phone,
          short_description: form.short_description,
          referralCode: referralCode || undefined,
          claimProfileId: claimId || undefined,
          os_entity_type: form.os_entity_type,
          legal_form: form.legal_form,
          join_lane: form.join_lane,
          requires_approval: requiresApproval,
          os_sector: form.os_sector,
          os_industry: form.os_industries[0] || null,
          os_industries: form.os_industries,
          os_business_type_id: form.os_business_types[0] || null,
          os_business_type_ids: form.os_business_types,
          industry_packs: form.industry_packs,
          industry_modules: form.industry_modules,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'ALREADY_CLAIMED' && (data.profileId || claimId)) {
          const pid = Number(data.profileId || claimId);
          setClaimConflict({
            profileId: pid,
            connectHref: data.connectHref || `/c/${pid}`,
          });
          toast.message('Listing already has an owner');
        } else {
          toast.error(data.error || 'Registration failed');
        }
        setSubmitting(false);
        return;
      }

      if (data.profileId) {
        localStorage.setItem('selectedCompanyId', String(data.profileId));
        if (data.tradingName) {
          localStorage.setItem('selectedCompanyName', data.tradingName);
        }
        setDoneProfileId(Number(data.profileId));
      }
      setDoneLifetime(
        Boolean(data.lifetime?.status === 'lifetime' || data.claimed)
      );
      setDoneContactRequired(
        data.setupStatus === 'contact_required' ||
          data.setupStatus === 'pending_approval' ||
          requiresApproval ||
          entity?.setupPath === 'contact_required'
      );

      if (referralCode && /^\d+$/.test(String(referralCode))) {
        void fetch('/api/public/invite-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'accepted',
            ref: referralCode,
            email: form.contact_email || extractEmailFromPrivyUser(user),
            claim: claimId || data.profileId,
          }),
        }).catch(() => undefined);
      }

      setDone(true);
      toast.success(
        data.setupStatus === 'pending_approval' || requiresApproval
          ? 'Request sent — platform admin must approve government access'
          : data.setupStatus === 'contact_required'
            ? 'A specialist will contact you to complete setup'
            : data.claimed
              ? 'Listing claimed — workspace ready!'
              : 'Workspace ready!'
      );

      const partner = (searchParams.get('partner') || '').toLowerCase().trim();
      const intent = (searchParams.get('intent') || '').toLowerCase().trim();
      const product =
        searchParams.get('product') || searchParams.get('sku') || '';
      const source = searchParams.get('source') || '';
      const channel = searchParams.get('channel') || '';
      let dest =
        data.homePath ||
        resolveEntityKind(business_type).homePath ||
        '/dashboard/select-company';
      if (
        partner &&
        (intent === 'order' || intent === 'trade' || intent === 'quote')
      ) {
        const qs = new URLSearchParams();
        if (source) qs.set('source', source);
        if (searchParams.get('ref')) qs.set('ref', String(searchParams.get('ref')));
        if (channel) qs.set('channel', channel);
        if (product) qs.set('product', product);
        const q = qs.toString();
        dest = product
          ? `/store/${encodeURIComponent(partner)}/products/${encodeURIComponent(product)}${q ? `?${q}` : ''}`
          : `/store/${encodeURIComponent(partner)}${q ? `?${q}` : ''}`;
      }
      setTimeout(() => router.push(dest), 2400);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (claimConflict) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            Listing already claimed
          </h1>
          <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
            Company #{claimConflict.profileId} already has an owner.
          </p>
          <Link
            href={claimConflict.connectHref || `/c/${claimConflict.profileId}`}
            className="btn-primary !py-3 text-sm"
          >
            View listing & connect
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-3">
            {doneContactRequired
              ? joinLane === 'b2g'
                ? 'Awaiting approval'
                : 'Request received'
              : 'Welcome aboard'}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">
            {doneContactRequired
              ? joinLane === 'b2g'
                ? 'A SupplierAdvisor admin must approve this government workspace before it opens. Redirecting…'
                : 'A specialist will contact you to complete provincial / national setup. Redirecting…'
              : doneLifetime
                ? 'Founding seat ready. Redirecting…'
                : 'Your Core OS workspace is ready. Redirecting…'}
          </p>
          {doneProfileId ? (
            <p className="text-xs text-neutral-400">Workspace #{doneProfileId}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.png"
              alt="SupplierAdvisor"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-black text-sm text-slate-900 hidden sm:inline">
              SupplierAdvisor®
            </span>
          </Link>
          <div className="flex-1 max-w-xs mx-4">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#00b4d8] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-400 mt-1 text-center">
              {STEPS[step]} · {step + 1}/{STEPS.length}
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 tabular-nums">
            Core R{CORE_OS_MONTHLY_ZAR}
            {price.packCount
              ? ` + ${price.packCount}×R${INDUSTRY_PACK_MONTHLY_ZAR}`
              : ''}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28">
        {/* Selection trail — always visible after Account */}
        {step >= 1 ? (
          <div className="mb-6 rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-2">
              Your selection
            </p>
            <ol className="flex flex-wrap items-center gap-1.5 text-sm">
              <TrailChip
                n={1}
                label={joinLane === 'b2g' ? 'Government' : 'Org type'}
                value={
                  (joinLane === 'b2g'
                    ? B2G_ORG_TYPES
                    : B2B_ORG_TYPES
                  ).find((o) => o.id === form.legal_form)?.label ||
                  form.legal_form ||
                  null
                }
                active={current === 'Org type' || current === 'Government'}
                done={Boolean(form.legal_form) && step > 1}
              />
              {joinLane === 'b2b' ? (
                <>
                  <span className="text-slate-300 font-bold">→</span>
                  <TrailChip
                    n={2}
                    label="Sector"
                    value={sectorDef?.label}
                    active={current === 'Sector'}
                    done={Boolean(form.os_sector) && current !== 'Sector' && current !== 'Org type'}
                  />
                  <span className="text-slate-300 font-bold">→</span>
                  <TrailChip
                    n={3}
                    label="Industry"
                    value={
                      industryDefs.length
                        ? industryDefs.map((i) => i.label).join(' · ')
                        : null
                    }
                    active={current === 'Industry'}
                    done={
                      form.os_industries.length > 0 &&
                      current !== 'Industry' &&
                      current !== 'Sector' &&
                      current !== 'Org type'
                    }
                  />
                  <span className="text-slate-300 font-bold">→</span>
                  <TrailChip
                    n={4}
                    label="Business type"
                    value={
                      form.os_business_types.length
                        ? `${form.os_business_types.length} selected`
                        : null
                    }
                    active={current === 'Business type'}
                    done={
                      form.os_business_types.length > 0 &&
                      (current === 'Details' || current === 'Review')
                    }
                  />
                </>
              ) : (
                <span className="text-[11px] font-semibold text-violet-800">
                  · Admin approval required
                </span>
              )}
            </ol>
            {form.industry_packs.length > 0 ? (
              <p className="text-[11px] text-slate-600 mt-2">
                Industry packs:{' '}
                <strong>
                  {form.industry_packs
                    .map((id) => getIndustryPack(id)?.shortName || id)
                    .join(', ')}
                </strong>{' '}
                · est. R{price.total}/mo
              </p>
            ) : form.os_sector ? (
              <p className="text-[11px] text-slate-600 mt-2">
                Core OS only (R{CORE_OS_MONTHLY_ZAR}/mo) until industry packs apply
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Account */}
        {current === 'Account' ? (
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {joinLane === 'b2g'
                  ? 'Request government access'
                  : 'Register a business'}
              </h1>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                {joinLane === 'b2g'
                  ? 'Government workspaces need SupplierAdvisor admin approval. Sign in, name the office, and submit. You will not get a live desk until a platform admin activates it.'
                  : `Next you choose organisation type (private, public, NPO), then sector → industry → business type. Core OS from R${CORE_OS_MONTHLY_ZAR}/mo · Industry Packs +R${INDUSTRY_PACK_MONTHLY_ZAR}/mo · 30-day trial.`}
              </p>
            </div>
            {authenticated ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 flex gap-2 items-center">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                Signed in
                {user?.email?.address || extractEmailFromPrivyUser(user)
                  ? ` as ${user?.email?.address || extractEmailFromPrivyUser(user)}`
                  : ''}
                . Continue to the next step.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => login()}
                className="btn-primary !py-3 !px-6 text-sm w-full sm:w-auto"
              >
                Sign in to continue
              </button>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#00b4d8]" />
                Setup path
              </p>
              {joinLane === 'b2g' ? (
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <strong>Government type</strong> — national, provincial,
                    municipal, education or health
                  </li>
                  <li>
                    <strong>Office details</strong> — official name and contacts
                  </li>
                  <li>
                    <strong>Platform approval</strong> — an admin activates the
                    workspace
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <strong>Organisation type</strong> — private, public, NPO or
                    association
                  </li>
                  <li>
                    <strong>Sector</strong> — Primary, Secondary, Tertiary or
                    Quaternary
                  </li>
                  <li>
                    <strong>Industry</strong> — e.g. Food manufacturing, Logistics
                  </li>
                  <li>
                    <strong>Business type</strong> — role within that industry
                  </li>
                  <li>
                    <strong>Company details</strong> — trading name and contacts
                  </li>
                </ol>
              )}
            </div>
          </section>
        ) : null}

        {current === 'Org type' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              What type of organisation?
            </h1>
            <p className="text-sm text-slate-600">
              Private, public, NPO or association. This is the legal form —
              you pick sector and industry next.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {B2B_ORG_TYPES.map((row) => {
                const on = form.legal_form === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectOrgType(row)}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50 shadow-sm ring-2 ring-[#00b4d8]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="font-black text-base text-slate-900">
                      {row.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {row.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {current === 'Government' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Which government office?
            </h1>
            <p className="text-sm text-slate-600">
              This workspace stays closed until a SupplierAdvisor platform
              admin approves it.
            </p>
            <div className="space-y-2">
              {B2G_ORG_TYPES.map((row) => {
                const on = form.legal_form === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectOrgType(row)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                      on
                        ? 'border-violet-500 bg-violet-50 shadow-sm ring-2 ring-violet-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="font-black text-sm text-slate-900">
                      {row.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {row.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Sector */}
        {current === 'Sector' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Which sector are you in?
            </h1>
            <p className="text-sm text-slate-600">
              Required. This filters industries and modules for your workspace.
              You will only see packs and tools for this sector.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {OS_SECTORS.filter((s) => s.id !== 'public_sector').map((s) => {
                const on = form.os_sector === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSector(s.id as OsSectorId)}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50 shadow-sm ring-2 ring-[#00b4d8]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                      Sector
                    </p>
                    <p className="font-black text-base text-slate-900 mt-0.5">
                      {s.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {s.description}
                    </p>
                    {on ? (
                      <span className="inline-flex mt-2 text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Industries (multi) */}
        {current === 'Industry' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Which industries?
            </h1>
            <p className="text-sm text-slate-600">
              Select one or more industries in{' '}
              <strong className="text-slate-900">
                {sectorLabel(form.os_sector)}
              </strong>
              . Each selection adds recommended Industry Packs.
            </p>
            {!form.os_sector ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Go back and choose a sector first.
              </p>
            ) : (
              <div className="space-y-2">
                {industries.map((ind) => {
                  const on = form.os_industries.includes(ind.id);
                  const packNames = ind.packIds
                    .map((id) => getIndustryPack(id)?.shortName || id)
                    .join(', ');
                  return (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => toggleIndustry(ind.id)}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50 ring-2 ring-[#00b4d8]/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                            Industry · {sectorLabel(form.os_sector)}
                          </p>
                          <p className="font-black text-sm text-slate-900 mt-0.5">
                            {on ? '✓ ' : ''}
                            {ind.label}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {ind.description}
                          </p>
                          {packNames ? (
                            <p className="text-[10px] font-semibold text-slate-600 mt-1.5">
                              Packs: {packNames} · {ind.businessTypes.length}{' '}
                              business types
                            </p>
                          ) : (
                            <p className="text-[10px] font-semibold text-slate-600 mt-1.5">
                              {ind.businessTypes.length} business types · Core OS
                            </p>
                          )}
                        </div>
                        {on ? (
                          <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            Selected
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* Business type(s) multi */}
        {current === 'Business type' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Business type(s)
            </h1>
            <p className="text-sm text-slate-600">
              Roles within{' '}
              <strong className="text-slate-900">
                {industryDefs.map((i) => i.label).join(' · ') ||
                  'your industries'}
              </strong>{' '}
              ({sectorLabel(form.os_sector)}). Select one or more.
            </p>
            {!industryDefs.length ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Go back and choose an industry first.
              </p>
            ) : (
              <div className="space-y-4">
                {industryDefs.map((ind) => (
                  <div key={ind.id}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-2">
                      {ind.label}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {ind.businessTypes.map((bt) => {
                        const on = form.os_business_types.includes(bt.id);
                        return (
                          <button
                            key={`${ind.id}-${bt.id}`}
                            type="button"
                            onClick={() => toggleBusinessType(bt.id)}
                            className={`text-left rounded-2xl border-2 p-3.5 transition ${
                              on
                                ? 'border-[#00b4d8] bg-sky-50 ring-2 ring-[#00b4d8]/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                              Business type
                            </p>
                            <p className="font-black text-sm text-slate-900 mt-0.5">
                              {on ? '✓ ' : ''}
                              {bt.label}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                              {bt.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Step 4 — Details */}
        {current === 'Details' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              {joinLane === 'b2g' ? 'Office details' : 'Company details'}
            </h1>
            <p className="text-sm text-slate-600">
              {joinLane === 'b2g' ? (
                <>
                  Requesting access as{' '}
                  <strong>
                    {B2G_ORG_TYPES.find((o) => o.id === form.legal_form)
                      ?.label || 'government'}
                  </strong>
                  . An admin must approve before this workspace opens.
                </>
              ) : (
                <>
                  Registering as{' '}
                  <strong>{businessTypeDef?.label || '—'}</strong> in{' '}
                  <strong>
                    {industryDefs.map((i) => i.label).join(' · ') || '—'}
                  </strong>{' '}
                  ({sectorLabel(form.os_sector)}).
                </>
              )}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Trading name *
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  value={form.trading_name}
                  onChange={(e) => update('trading_name', e.target.value)}
                  placeholder="How you trade"
                />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Legal name
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={form.legal_name}
                  onChange={(e) => update('legal_name', e.target.value)}
                />
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Registration no.
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={form.registration_number}
                  onChange={(e) =>
                    update('registration_number', e.target.value)
                  }
                />
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  City
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Contact name *
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  value={form.contact_name}
                  onChange={(e) => update('contact_name', e.target.value)}
                />
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Contact email *
                </span>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  value={form.contact_email}
                  onChange={(e) => update('contact_email', e.target.value)}
                />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Phone
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={form.contact_phone}
                  onChange={(e) => update('contact_phone', e.target.value)}
                />
              </label>
            </div>
          </section>
        ) : null}

        {/* Review */}
        {current === 'Review' ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Review & confirm
            </h1>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
              <Row
                label={joinLane === 'b2g' ? 'Government' : 'Organisation'}
                value={
                  (joinLane === 'b2g' ? B2G_ORG_TYPES : B2B_ORG_TYPES).find(
                    (o) => o.id === form.legal_form
                  )?.label || form.legal_form
                }
              />
              {joinLane === 'b2b' ? (
                <>
              <Row label="Sector" value={sectorDef?.label || form.os_sector} />
              <Row
                label="Industries"
                value={
                  industryDefs.map((i) => i.label).join(' · ') ||
                  form.os_industries.join(', ')
                }
              />
              <Row
                label="Business type(s)"
                value={
                  form.os_business_types.length
                    ? `${form.os_business_types.length} selected`
                    : '—'
                }
              />
              <Row
                label="Entity class"
                value={entityDef?.label || form.os_entity_type}
              />
                </>
              ) : null}
              <Row
                label="Industry packs"
                value={
                  form.industry_packs.length
                    ? form.industry_packs
                        .map((id) => getIndustryPack(id)?.name || id)
                        .join(', ')
                    : 'Core OS only'
                }
              />
              <Row label="Company" value={form.trading_name} />
              <Row
                label="Contact"
                value={`${form.contact_name} · ${form.contact_email}`}
              />
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Est. monthly
                </span>
                <span className="text-lg font-black text-slate-900">
                  R{price.total}
                  <span className="text-xs font-bold text-slate-400">/mo</span>
                </span>
              </div>
              {joinLane === 'b2g' || contactRequired ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
                  <Layers className="w-4 h-4 inline mr-1" />
                  <strong>
                    {joinLane === 'b2g'
                      ? 'Platform approval required:'
                      : 'Specialist setup:'}
                  </strong>{' '}
                  {joinLane === 'b2g'
                    ? 'A SupplierAdvisor admin must activate this government workspace. You will not get a live desk until then.'
                    : 'Provincial and National government complete selection here; a SupplierAdvisor specialist will contact you to finish activation.'}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  Full self-serve activation after confirm (30-day trial on Core
                  OS). Your modules page will show only{' '}
                  <strong>{sectorDef?.label}</strong> industries.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="fixed bottom-0 inset-x-0 border-t border-slate-200 bg-white/95 backdrop-blur z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={current === 'Account'}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={goNext}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1 disabled:opacity-40"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !canNext}
              onClick={() => void submit()}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {contactRequired ? 'Request specialist setup' : 'Create workspace'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function TrailChip({
  n,
  label,
  value,
  active,
  done,
}: {
  n: number;
  label: string;
  value?: string | null;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <li
      className={`rounded-xl border px-2.5 py-1.5 min-w-0 ${
        active
          ? 'border-[#00b4d8] bg-sky-50'
          : done
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-slate-200 bg-white'
      }`}
    >
      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {n}. {label}
      </span>
      <div className="text-xs font-bold text-slate-900 truncate max-w-[10rem] sm:max-w-[14rem]">
        {value || '—'}
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 text-right max-w-[70%]">
        {value || '—'}
      </span>
    </div>
  );
}
