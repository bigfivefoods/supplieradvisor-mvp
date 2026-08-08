'use client';

/**
 * Core OS onboarding — Entity → Sector → Packs → Modules → Details → Review
 * Brief 2026-08-09. Preserves invite claim, referral, partner storefront handoff.
 */
import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Landmark,
  Loader2,
  ShieldCheck,
  Layers,
  Package,
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
  INDUSTRY_PACKS,
  OS_ENTITY_TYPES,
  OS_SECTORS,
  defaultSectorForEntity,
  getIndustryPack,
  getOsEntityType,
  monthlyPriceZar,
  recommendPackIds,
  type OsEntityTypeId,
  type OsSectorId,
} from '@/lib/product/architecture';

const STEPS = [
  'Account',
  'Entity',
  'Sector',
  'Packs',
  'Modules',
  'Details',
  'Review',
] as const;

type FormState = {
  os_entity_type: string;
  os_sector: string;
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

function mapTypeParamToEntity(typeParam: string): string {
  const t = typeParam.toLowerCase();
  if (t === 'school' || t === 'education') return 'school';
  if (t === 'government' || t === 'gov' || t === 'dbe') return 'municipal';
  if (t === 'provincial') return 'provincial';
  if (t === 'national') return 'national';
  if (t === 'municipal') return 'municipal';
  return 'private_company';
}

export default function BusinessOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || 'business';
  const claimId = Number(searchParams.get('claim') || 0) || null;
  const claimName = searchParams.get('name') || '';
  const prefillEmail = searchParams.get('email') || '';
  const { ready, authenticated, user, login } = usePrivy();

  const initialEntity = mapTypeParamToEntity(typeParam);
  const initialSector = defaultSectorForEntity(initialEntity);

  const [step, setStep] = useState(0);
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
    os_entity_type: initialEntity,
    os_sector: initialSector,
    industry_packs: [],
    industry_modules: [],
    business_type: getOsEntityType(initialEntity)?.businessType || 'business',
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

  // Auto sector for public entities
  useEffect(() => {
    const e = getOsEntityType(form.os_entity_type);
    if (e?.publicSector && form.os_sector !== 'public_sector') {
      setForm((f) => ({ ...f, os_sector: 'public_sector' }));
    }
  }, [form.os_entity_type, form.os_sector]);

  // Prefill recommended packs when landing on pack step empty
  const recommended = useMemo(
    () => recommendPackIds(form.os_entity_type, form.os_sector),
    [form.os_entity_type, form.os_sector]
  );

  const price = useMemo(
    () => monthlyPriceZar(form.industry_packs),
    [form.industry_packs]
  );

  const entityDef = getOsEntityType(form.os_entity_type);
  const contactRequired = entityDef?.setupPath === 'contact_required';

  const modulesForSelectedPacks = useMemo(() => {
    const out: Array<{
      packId: string;
      packName: string;
      id: string;
      name: string;
      description: string;
    }> = [];
    for (const pid of form.industry_packs) {
      const pack = getIndustryPack(pid);
      if (!pack) continue;
      for (const m of pack.modules) {
        out.push({
          packId: pack.id,
          packName: pack.shortName,
          id: m.id,
          name: m.name,
          description: m.description,
        });
      }
    }
    return out;
  }, [form.industry_packs]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const canNext = useMemo(() => {
    if (step === 0) return authenticated;
    if (step === 1) return Boolean(form.os_entity_type);
    if (step === 2) return Boolean(form.os_sector);
    if (step === 3) return true; // packs optional (Core only)
    if (step === 4) return true; // modules optional
    if (step === 5) {
      return (
        form.trading_name.trim().length >= 2 &&
        form.contact_name.trim().length >= 2 &&
        form.contact_email.includes('@')
      );
    }
    return true;
  }, [step, authenticated, form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePack = (packId: string) => {
    setForm((prev) => {
      const has = prev.industry_packs.includes(packId);
      const industry_packs = has
        ? prev.industry_packs.filter((id) => id !== packId)
        : [...prev.industry_packs, packId];
      // Drop modules from removed packs
      const stillValid = new Set(
        industry_packs.flatMap(
          (pid) => getIndustryPack(pid)?.modules.map((m) => m.id) || []
        )
      );
      const industry_modules = prev.industry_modules.filter((id) =>
        stillValid.has(id)
      );
      return { ...prev, industry_packs, industry_modules };
    });
  };

  const toggleModule = (moduleId: string) => {
    setForm((prev) => {
      const has = prev.industry_modules.includes(moduleId);
      return {
        ...prev,
        industry_modules: has
          ? prev.industry_modules.filter((id) => id !== moduleId)
          : [...prev.industry_modules, moduleId],
      };
    });
  };

  const applyRecommendedPacks = () => {
    setForm((prev) => ({
      ...prev,
      industry_packs: [...new Set([...prev.industry_packs, ...recommended])],
    }));
    toast.success('Recommended packs selected');
  };

  const ensureAuthPrefill = () => {
    if (!user) return;
    const email = extractEmailFromPrivyUser(user);
    if (email && !form.contact_email) {
      update('contact_email', email);
    }
  };

  const goNext = () => {
    if (step === 0 && !authenticated) {
      login();
      return;
    }
    if (step === 0) ensureAuthPrefill();
    // Skip modules step if no packs
    if (step === 3 && form.industry_packs.length === 0) {
      setStep(5);
      return;
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 5 && form.industry_packs.length === 0) {
      setStep(3);
      return;
    }
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
    const business_type = entity?.businessType || 'business';

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
          industry: form.industry || form.os_sector,
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
          os_sector: form.os_sector,
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
        data.setupStatus === 'contact_required'
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
            {doneContactRequired ? 'Request received' : 'Welcome aboard'}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">
            {doneContactRequired
              ? 'A specialist will contact you to complete provincial / national setup. Redirecting…'
              : doneLifetime
                ? 'Founding seat ready. Redirecting…'
                : 'Your Core OS workspace is ready. Redirecting…'}
          </p>
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
        {/* Step 0 — Account */}
        {step === 0 ? (
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Join SupplierAdvisor
              </h1>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                Core OS from R{CORE_OS_MONTHLY_ZAR}/mo · Industry Packs +R
                {INDUSTRY_PACK_MONTHLY_ZAR}/mo each · 30-day trial.
              </p>
            </div>
            {authenticated ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 flex gap-2 items-center">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                Signed in
                {user?.email?.address || extractEmailFromPrivyUser(user)
                  ? ` as ${user?.email?.address || extractEmailFromPrivyUser(user)}`
                  : ''}
                . Continue to choose your organisation type.
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">How packaging works</p>
              <p>
                <strong>Core OS</strong> — Control Tower, Suppliers, Customers,
                Ops, Inventory, Quality, Finance, Intelligence.
              </p>
              <p>
                <strong>Industry Packs</strong> — add vertical tools (+R
                {INDUSTRY_PACK_MONTHLY_ZAR}/mo each).
              </p>
              <p>
                <strong>Modules</strong> — turn pack capabilities on/off.
              </p>
            </div>
          </section>
        ) : null}

        {/* Step 1 — Entity type */}
        {step === 1 ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              What type of organisation?
            </h1>
            <p className="text-sm text-slate-600">
              Required. This drives recommendations and public-sector rules.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {OS_ENTITY_TYPES.map((e) => {
                const Icon =
                  e.id === 'school'
                    ? GraduationCap
                    : e.publicSector
                      ? Landmark
                      : Building2;
                const on = form.os_entity_type === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      update('os_entity_type', e.id);
                      update('business_type', e.businessType);
                      if (e.publicSector) update('os_sector', 'public_sector');
                    }}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 mb-2 ${on ? 'text-[#0077b6]' : 'text-slate-400'}`}
                    />
                    <p className="font-black text-sm text-slate-900">
                      {e.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {e.description}
                    </p>
                    {e.setupPath === 'contact_required' ? (
                      <span className="inline-block mt-2 text-[10px] font-bold uppercase text-violet-800 bg-violet-100 px-2 py-0.5 rounded-full">
                        Specialist setup
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Step 2 — Sector */}
        {step === 2 ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">Sector</h1>
            <p className="text-sm text-slate-600">
              {entityDef?.publicSector
                ? 'Public sector is selected for government and school entities.'
                : 'Required. Drives Industry Pack recommendations.'}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {OS_SECTORS.map((s) => {
                const locked =
                  entityDef?.publicSector && s.id !== 'public_sector';
                const on = form.os_sector === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={Boolean(locked)}
                    onClick={() => update('os_sector', s.id as OsSectorId)}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50'
                        : locked
                          ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="font-black text-sm">{s.label}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {s.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Step 3 — Packs */}
        {step === 3 ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-black text-slate-900">
                  Industry Packs
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Optional. Core OS alone is fine. Each pack +R
                  {INDUSTRY_PACK_MONTHLY_ZAR}/mo.
                </p>
              </div>
              {recommended.length ? (
                <button
                  type="button"
                  onClick={applyRecommendedPacks}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Apply recommended
                </button>
              ) : null}
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
              Recommended for your entity + sector:{' '}
              <strong>
                {recommended.length
                  ? recommended
                      .map((id) => getIndustryPack(id)?.shortName || id)
                      .join(', ')
                  : 'Core only'}
              </strong>
            </div>
            <div className="space-y-2">
              {INDUSTRY_PACKS.map((p) => {
                const on = form.industry_packs.includes(p.id);
                const rec = recommended.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePack(p.id)}
                    className={`w-full text-left rounded-2xl border-2 p-4 flex gap-3 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        on
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {on ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-sm text-slate-900">
                          {p.name}
                        </p>
                        <span className="text-[10px] font-bold text-slate-500">
                          +R{p.monthlyZar}/mo
                        </span>
                        {rec ? (
                          <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {p.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Running total:{' '}
              <strong className="text-slate-800">
                R{price.total}/mo
              </strong>{' '}
              (Core R{price.core}
              {price.packCount
                ? ` + ${price.packCount} pack(s) R${price.packs}`
                : ''}
              )
            </p>
          </section>
        ) : null}

        {/* Step 4 — Modules */}
        {step === 4 ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Industry modules
            </h1>
            <p className="text-sm text-slate-600">
              Recommended. Leave empty to enable all modules in selected packs.
              You can change this later under Administration → Modules.
            </p>
            {modulesForSelectedPacks.length === 0 ? (
              <p className="text-sm text-slate-500">
                No packs selected — skip to company details.
              </p>
            ) : (
              <div className="space-y-2">
                {modulesForSelectedPacks.map((m) => {
                  const on = form.industry_modules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      className={`w-full text-left rounded-xl border p-3 flex gap-3 ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Package
                        className={`w-4 h-4 shrink-0 mt-0.5 ${on ? 'text-[#0077b6]' : 'text-slate-400'}`}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {m.name}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            · {m.packName}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {m.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* Step 5 — Details */}
        {step === 5 ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Company details
            </h1>
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

        {/* Step 6 — Review */}
        {step === 6 ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">
              Review & confirm
            </h1>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
              <Row
                label="Entity"
                value={entityDef?.label || form.os_entity_type}
              />
              <Row
                label="Sector"
                value={
                  OS_SECTORS.find((s) => s.id === form.os_sector)?.label ||
                  form.os_sector
                }
              />
              <Row
                label="Packs"
                value={
                  form.industry_packs.length
                    ? form.industry_packs
                        .map((id) => getIndustryPack(id)?.name || id)
                        .join(', ')
                    : 'Core OS only'
                }
              />
              <Row
                label="Modules"
                value={
                  form.industry_modules.length
                    ? `${form.industry_modules.length} selected`
                    : form.industry_packs.length
                      ? 'All modules in selected packs'
                      : '—'
                }
              />
              <Row label="Company" value={form.trading_name} />
              <Row label="Contact" value={`${form.contact_name} · ${form.contact_email}`} />
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Est. monthly
                </span>
                <span className="text-lg font-black text-slate-900">
                  R{price.total}
                  <span className="text-xs font-bold text-slate-400">/mo</span>
                </span>
              </div>
              {contactRequired ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
                  <Layers className="w-4 h-4 inline mr-1" />
                  <strong>Specialist setup:</strong> Provincial and National
                  government complete pack selection here; a SupplierAdvisor
                  specialist will contact you to finish activation.
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  Full self-serve activation after confirm (30-day trial on Core
                  OS).
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
            disabled={step === 0}
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
