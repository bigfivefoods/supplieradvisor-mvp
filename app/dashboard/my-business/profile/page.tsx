'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2,
  Save,
  ShieldCheck,
  AlertTriangle,
  Upload,
  MapPin,
  Plus,
  Trash2,
  ImageIcon,
  FileText,
  X,
  Wallet,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';
import type {
  CertificationEntry,
  CompanyProfile,
  ExportLicenseEntry,
} from '@/lib/business/types';
import {
  COMPANY_INDUSTRIES,
  subIndustriesFor,
} from '@/lib/business/industries';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="h-72 rounded-3xl bg-neutral-100 animate-pulse flex items-center justify-center text-xs text-neutral-400">
      Loading map…
    </div>
  ),
});

const CERTS_PRESET = [
  'ISO 9001',
  'ISO 22000',
  'ISO 14001',
  'ISO 45001',
  'HACCP',
  'BRC',
  'SQF',
  'Halal',
  'Kosher',
  'Organic',
  'Fairtrade',
  'FSSC 22000',
];

const BEE = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Non-compliant',
];

/** Identity → business type dropdown (values stored on profiles.business_type). */
const BUSINESS_TYPE_OPTIONS = [
  'Private Company (Pty Ltd)',
  'Public Company (Ltd)',
  'Close Corporation (CC)',
  'Sole Proprietor',
  'Partnership',
  'Non-Profit Company (NPC)',
  'Trust',
  'Cooperative',
  'Government entity',
  'School / Education',
  'Association / Industry body',
  'NGO / Impact',
  'Supplier',
  'Business',
  'Other',
] as const;

const VERIFY_AMOUNT_ZAR = 69;
const VERIFY_AMOUNT_CENTS = VERIFY_AMOUNT_ZAR * 100;
/** Bank account AVS via VerifyNow — R50 Paystack */
const BANK_VERIFY_AMOUNT_ZAR = 50;
const BANK_VERIFY_AMOUNT_CENTS = BANK_VERIFY_AMOUNT_ZAR * 100;

const BANK_ACCOUNT_TYPES = ['Current', 'Savings', 'Cheque', 'Transmission', 'Bond', 'Credit'] as const;

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

function extractWalletFromPrivy(user: {
  wallet?: { address?: string | null } | null;
  linkedAccounts?: ReadonlyArray<{ type?: string; address?: string | null }> | null;
} | null | undefined): string | null {
  if (!user) return null;
  if (user.wallet?.address) return user.wallet.address;
  for (const a of user.linkedAccounts || []) {
    if (
      a.address &&
      (a.type === 'wallet' ||
        a.type === 'smart_wallet' ||
        a.type === 'embedded_wallet' ||
        String(a.type || '').includes('wallet'))
    ) {
      return a.address;
    }
  }
  return null;
}

export default function BusinessProfilePage() {
  return (
    <CompanyRequired>
      <ProfileInner />
    </CompanyRequired>
  );
}

function ProfileInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const loginWallet = extractWalletFromPrivy(user);

  const [form, setForm] = useState<Partial<CompanyProfile>>({});
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSubIndustries, setSelectedSubIndustries] = useState<string[]>([]);
  const [certEntries, setCertEntries] = useState<CertificationEntry[]>([]);
  const [exportLicenses, setExportLicenses] = useState<ExportLicenseEntry[]>([]);
  const [geo, setGeo] = useState<GeoValue>({
    continent: '',
    country: '',
    province: '',
    city: '',
  });
  const [completeness, setCompleteness] = useState<{ pct: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyConsent, setVerifyConsent] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    status?: string;
    message?: string;
    verification?: Record<string, unknown>;
  } | null>(null);
  const [bankPaying, setBankPaying] = useState(false);
  const [bankVerifying, setBankVerifying] = useState(false);
  const [bankVerifyConsent, setBankVerifyConsent] = useState(false);
  const [bankVerifyResult, setBankVerifyResult] = useState<{
    status?: string;
    message?: string;
    verification?: Record<string, unknown>;
  } | null>(null);

  const subIndustryOptions = useMemo(
    () => subIndustriesFor(selectedIndustries),
    [selectedIndustries]
  );

  const latNum = form.latitude != null && form.latitude !== '' ? Number(form.latitude) : null;
  const lngNum = form.longitude != null && form.longitude !== '' ? Number(form.longitude) : null;
  const mapPos: [number, number] | null =
    latNum != null && lngNum != null && Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? [latNum, lngNum]
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const profile = (data.profile || {}) as Partial<CompanyProfile>;
      setForm(profile);

      const inds = Array.isArray(profile.industries)
        ? profile.industries.map(String)
        : profile.industry
          ? [String(profile.industry)]
          : [];
      setSelectedIndustries(inds);

      const subs = Array.isArray(profile.sub_industries)
        ? profile.sub_industries.map(String)
        : profile.sub_industry
          ? [String(profile.sub_industry)]
          : [];
      setSelectedSubIndustries(subs);

      const uploaded = Array.isArray(profile.uploaded_certificates)
        ? (profile.uploaded_certificates as CertificationEntry[])
        : [];
      if (uploaded.length) {
        setCertEntries(uploaded);
      } else if (Array.isArray(profile.certifications)) {
        setCertEntries(profile.certifications.map((n) => ({ name: String(n) })));
      } else {
        setCertEntries([]);
      }

      setExportLicenses(
        Array.isArray(profile.export_licenses)
          ? (profile.export_licenses as ExportLicenseEntry[])
          : []
      );

      setGeo({
        continent: String(profile.continent || ''),
        country: String(profile.country || ''),
        province: String(profile.province || profile.region || ''),
        city: String(profile.city || ''),
      });

      setCompleteness(data.completeness || null);
      setWarning(typeof data.warning === 'string' ? data.warning : null);

      // Restore last VerifyNow CIPC + bank AVS snapshots from metadata
      const meta =
        profile.metadata && typeof profile.metadata === 'object'
          ? (profile.metadata as {
              verification?: Record<string, unknown>;
              bank_verification?: Record<string, unknown>;
            })
          : null;
      if (meta?.bank_verification && typeof meta.bank_verification === 'object') {
        const bv = meta.bank_verification;
        setBankVerifyResult({
          status: String(
            bv.status || profile.bank_verification_status || ''
          ),
          message: bv.summary
            ? `Last bank check: ${String(bv.summary)}`
            : undefined,
          verification: {
            summary: bv.summary,
            statusText: bv.status_text,
            identityAndAccountVerified: bv.identity_and_account_verified,
            accountFound: bv.account_found,
            accountOpen: bv.account_open,
            identityMatch: bv.identity_match,
            accountTypeMatch: bv.account_type_match,
            acceptsCredits: bv.accepts_credits,
            acceptsDebits: bv.accepts_debits,
            bankReference: bv.bank_reference,
            requestId: bv.request_id,
            holderType: bv.holder_type,
          },
        });
      }
      if (meta?.verification && typeof meta.verification === 'object') {
        const v = meta.verification;
        setVerifyResult({
          status: String(v.status || profile.verification_status || ''),
          message: v.company_name
            ? `Last CIPC check: ${String(v.company_name)}`
            : undefined,
          verification: {
            companyName: v.company_name,
            tradeName: v.trade_name,
            registrationNumber: v.registration_number,
            companyStatus: v.company_status,
            companyType: v.company_type,
            physicalAddress: v.physical_address,
            vatNumber: v.vat_number,
            taxNumber: v.tax_number,
            directorCount: v.director_count,
            nameMatch: v.name_match,
            requestId: v.request_id,
            statusText: v.company_status,
          },
        });
      }

      // Auto-fill wallet from login if profile empty
      if (!profile.wallet_address && loginWallet) {
        setForm((prev) => ({ ...prev, wallet_address: loginWallet }));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, loginWallet]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setPhone = (value: string) => {
    setForm((prev) => ({
      ...prev,
      contact_phone: value,
      contact_number: value,
      phone: value,
    }));
  };

  const setAddress = (value: string) => {
    setForm((prev) => ({
      ...prev,
      address: value,
      street: value,
    }));
  };

  const setDescription = (value: string) => {
    setForm((prev) => ({
      ...prev,
      description: value,
      short_description: value,
      about: value,
    }));
  };

  const onGeoChange = (next: GeoValue) => {
    setGeo(next);
    setForm((prev) => ({
      ...prev,
      continent: next.continent,
      country: next.country,
      province: next.province,
      region: next.province,
      city: next.city,
    }));
  };

  const toggleIndustry = (name: string) => {
    setSelectedIndustries((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      setForm((f) => ({
        ...f,
        industries: next,
        industry: next[0] || '',
      }));
      return next;
    });
  };

  const toggleSubIndustry = (name: string) => {
    setSelectedSubIndustries((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      setForm((f) => ({
        ...f,
        sub_industries: next,
        sub_industry: next[0] || '',
      }));
      return next;
    });
  };

  const togglePresetCert = (name: string) => {
    setCertEntries((prev) => {
      const exists = prev.some((c) => c.name === name);
      if (exists) return prev.filter((c) => c.name !== name);
      return [...prev, { name }];
    });
  };

  const addCustomCert = () => {
    setCertEntries((prev) => [
      ...prev,
      { name: '', awarded_date: '', expiry_date: '', file_url: '' },
    ]);
  };

  const updateCert = (idx: number, patch: Partial<CertificationEntry>) => {
    setCertEntries((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCert = (idx: number) => {
    setCertEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addExportLicense = () => {
    setExportLicenses((prev) => [
      ...prev,
      { country: geo.country || '', license_number: '', file_url: '' },
    ]);
  };

  const updateExport = (idx: number, patch: Partial<ExportLicenseEntry>) => {
    setExportLicenses((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeExport = (idx: number) => {
    setExportLicenses((prev) => prev.filter((_, i) => i !== idx));
  };

  /** Build a full PATCH body so every profile field + certs sync to Supabase. */
  const buildSavePayload = (overrides: Record<string, unknown> = {}) => {
    const phone = form.contact_phone || form.contact_number || form.phone || null;
    const street = form.street || form.address || null;
    const description =
      form.description || form.short_description || form.about || null;

    // Keep certificates that have a name OR a uploaded file (never drop file URLs)
    const cleanCerts = certEntries
      .map((c) => ({
        name: String(c.name || '').trim() || (c.file_url ? 'Certificate' : ''),
        awarded_date: c.awarded_date || null,
        expiry_date: c.expiry_date || null,
        file_url: c.file_url || null,
      }))
      .filter((c) => c.name || c.file_url);
    const certNames = cleanCerts.map((c) => c.name).filter(Boolean);

    const cleanExports = exportLicenses
      .map((e) => ({
        country: String(e.country || '').trim(),
        license_number: e.license_number || null,
        file_url: e.file_url || null,
      }))
      .filter((e) => e.country);

    const firstExport = cleanExports[0];
    const wallet = form.wallet_address || loginWallet || null;
    const businessType = String(form.business_type || form.category || '').trim() || null;

    return {
      companyId,
      privyUserId,
      // Explicit field list — do not rely only on ...form (avoids dropping state edges)
      trading_name: form.trading_name ?? null,
      legal_name: form.legal_name ?? null,
      registration_number: form.registration_number ?? null,
      registration_certificate_url: form.registration_certificate_url ?? null,
      // Production column name (critical dual-write)
      registration_document_url:
        form.registration_certificate_url ?? form.registration_document_url ?? null,
      vat_number: form.vat_number ?? null,
      vat_certificate_url: form.vat_certificate_url ?? null,
      vat_document_url: form.vat_certificate_url ?? form.vat_document_url ?? null,
      tax_number: form.tax_number ?? null,
      business_type: businessType,
      category: businessType,
      logo_url: form.logo_url ?? null,
      email: form.email ?? null,
      contact_name: form.contact_name ?? null,
      website: form.website ?? null,
      wallet_address: wallet,
      bee_level: form.bee_level ?? null,
      bee_certificate_url: form.bee_certificate_url ?? null,
      bank_name: form.bank_name ?? null,
      account_name: form.account_name ?? null,
      account_number: form.account_number ?? null,
      branch_code: form.branch_code ?? null,
      account_type: form.account_type ?? null,
      iban: form.iban ?? null,
      swift: form.swift ?? null,
      bank_confirmation_url: form.bank_confirmation_url ?? null,
      director_id_number: form.director_id_number ?? null,
      import_license_number: form.import_license_number ?? null,
      import_license_url: form.import_license_url ?? null,
      import_document_url: form.import_license_url ?? form.import_document_url ?? null,
      continent: geo.continent || form.continent || null,
      country: geo.country || form.country || null,
      province: geo.province || form.province || null,
      region: geo.province || form.region || null,
      city: geo.city || form.city || null,
      postal_code: form.postal_code ?? null,
      contact_phone: phone,
      contact_number: phone,
      phone,
      street,
      address: street,
      description,
      short_description: description,
      about: description,
      industries: selectedIndustries,
      industry: selectedIndustries[0] || form.industry || null,
      sub_industries: selectedSubIndustries,
      sub_industry: selectedSubIndustries[0] || form.sub_industry || null,
      certifications: certNames,
      iso_certifications: certNames,
      uploaded_certificates: cleanCerts,
      export_licenses: cleanExports,
      export_license_number: firstExport?.license_number || form.export_license_number || null,
      export_license_url: firstExport?.file_url || form.export_license_url || null,
      export_document_url:
        firstExport?.file_url || form.export_license_url || form.export_document_url || null,
      latitude: form.latitude ?? form.lat ?? null,
      longitude: form.longitude ?? form.lng ?? null,
      lat: form.latitude ?? form.lat ?? null,
      lng: form.longitude ?? form.lng ?? null,
      ...overrides,
    };
  };

  const applySavedProfile = (profile: Partial<CompanyProfile> | undefined | null) => {
    if (!profile) return;
    setForm((prev) => ({ ...prev, ...profile }));
    if (Array.isArray(profile.uploaded_certificates)) {
      setCertEntries(profile.uploaded_certificates as CertificationEntry[]);
    }
    if (Array.isArray(profile.export_licenses)) {
      setExportLicenses(profile.export_licenses as ExportLicenseEntry[]);
    }
    if (Array.isArray(profile.industries)) {
      setSelectedIndustries(profile.industries.map(String));
    }
    if (Array.isArray(profile.sub_industries)) {
      setSelectedSubIndustries(profile.sub_industries.map(String));
    }
  };

  /** Immediately sync one or more fields to Supabase (used after file uploads). */
  const persistPartial = async (patch: Record<string, unknown>) => {
    const res = await fetch('/api/business/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        ...patch,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not sync to Supabase');
    applySavedProfile(data.profile);
    if (data.completeness) setCompleteness(data.completeness);
    return data;
  };

  const handleUpload = async (
    file: File | null,
    kind: string,
    onUrl: (url: string) => void,
    /** App field (e.g. registration_certificate_url) — dual-written to production columns. */
    persistField?: string
  ) => {
    if (!file) return;
    setUploading(kind);
    try {
      const result = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind,
        privyUserId,
        profileField: persistField || null,
      });
      if (!result.url) {
        throw new Error(
          result.error ||
            (typeof result.details === 'string' ? result.details : null) ||
            'Upload failed'
        );
      }

      // Always update local form state with the public URL (+ legacy aliases)
      onUrl(result.url);
      if (persistField) {
        setForm((prev) => {
          const next: Partial<CompanyProfile> = {
            ...prev,
            [persistField]: result.url,
          };
          // Mirror onto known production column names for immediate UI consistency
          if (persistField === 'registration_certificate_url') {
            next.registration_document_url = result.url;
          }
          if (persistField === 'vat_certificate_url') {
            next.vat_document_url = result.url;
          }
          if (persistField === 'import_license_url') {
            next.import_document_url = result.url;
          }
          if (persistField === 'export_license_url') {
            next.export_document_url = result.url;
          }
          return next;
        });
      }

      if (result.profileSynced && result.profile) {
        applySavedProfile(result.profile as Partial<CompanyProfile>);
        toast.success(
          result.columnsWritten?.length
            ? `File saved to Supabase (${result.columnsWritten.join(', ')})`
            : 'File uploaded and saved to Supabase'
        );
      } else if (persistField) {
        // Server stored the file but profile URL write may have missed — dual-write via PATCH
        try {
          const patch: Record<string, unknown> = { [persistField]: result.url };
          if (persistField === 'registration_certificate_url') {
            patch.registration_document_url = result.url;
          }
          if (persistField === 'vat_certificate_url') {
            patch.vat_document_url = result.url;
          }
          if (persistField === 'import_license_url') {
            patch.import_document_url = result.url;
          }
          if (persistField === 'export_license_url') {
            patch.export_document_url = result.url;
          }
          await persistPartial(patch);
          toast.success('File uploaded and linked on company profile');
        } catch (syncErr: unknown) {
          toast.error(
            syncErr instanceof Error
              ? `File in storage but profile link failed: ${syncErr.message}`
              : 'File stored — click Save profile to link it'
          );
        }
      } else {
        toast.success('File uploaded — certificate list will sync on Save (or next cert update)');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!form.trading_name?.toString().trim()) {
      toast.error('Trading name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/business/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSavePayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      applySavedProfile(data.profile);
      setCompleteness(data.completeness || null);
      toast.success('Profile saved to Supabase');
      const { toastGoldenPathFromResponse } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathFromResponse(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const registrationForVerify = String(form.registration_number || '').trim();
  const vatForVerify = String(form.vat_number || '').trim();

  const applyVerifyResponse = (data: {
    message?: string;
    status?: string;
    profile?: Partial<CompanyProfile>;
    verification?: Record<string, unknown>;
  }) => {
    setVerifyResult({
      status: data.status,
      message: data.message,
      verification: data.verification,
    });
    if (data.profile) {
      setForm((prev) => ({
        ...prev,
        ...data.profile,
        verification_status:
          data.profile?.verification_status || data.status || prev.verification_status,
        is_verified:
          data.profile?.is_verified ??
          (data.status === 'verified' ? true : prev.is_verified),
        verified_at: data.profile?.verified_at || prev.verified_at,
        verification_payment_ref:
          data.profile?.verification_payment_ref || prev.verification_payment_ref,
        metadata: data.profile?.metadata || prev.metadata,
      }));
    } else if (data.status) {
      setForm((prev) => ({
        ...prev,
        verification_status: data.status,
        is_verified: data.status === 'verified',
        verified_at:
          data.status === 'verified' ? new Date().toISOString() : prev.verified_at,
      }));
    }
  };

  /**
   * After successful R69 Paystack payment, run VerifyNow CIPC (server-side).
   * Payment is required — free verification is not offered.
   */
  const runVerifyNow = async (paystackReference: string) => {
    if (!paystackReference?.trim()) {
      toast.error('Payment is required before verification (R69).');
      return;
    }
    if (!registrationForVerify && !vatForVerify) {
      toast.error('Add a CIPC registration number (or VAT number) first, then save.');
      return;
    }
    if (!verifyConsent) {
      toast.error('Confirm consent to run a CIPC company check via VerifyNow.');
      return;
    }

    setVerifying(true);
    toast.loading('Payment received — verifying with VerifyNow (CIPC)…', { id: 'vn-company' });
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          registrationNumber: registrationForVerify || undefined,
          vatNumber: vatForVerify || undefined,
          paystackReference,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'VerifyNow verification failed');
      }
      applyVerifyResponse(data);
      toast.success(data.message || 'Company verified via VerifyNow', { id: 'vn-company' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verification failed', {
        id: 'vn-company',
      });
    } finally {
      setVerifying(false);
      setPaying(false);
    }
  };

  /**
   * After R50 Paystack payment, run VerifyNow bank AVS (server-side).
   */
  const runBankVerifyNow = async (paystackReference: string) => {
    if (!paystackReference?.trim()) {
      toast.error('Payment is required before bank verification (R50).');
      return;
    }
    const accountNumber = String(form.account_number || '').replace(/\s/g, '');
    const branchCode = String(form.branch_code || '').replace(/\s/g, '');
    if (!accountNumber) {
      toast.error('Add a bank account number first, then save.');
      return;
    }
    if (!/^\d{6}$/.test(branchCode)) {
      toast.error('Add a valid 6-digit branch code first, then save.');
      return;
    }
    if (!bankVerifyConsent) {
      toast.error('Confirm consent to run a bank account check via VerifyNow.');
      return;
    }

    setBankVerifying(true);
    toast.loading('Payment received — verifying bank account with VerifyNow…', {
      id: 'vn-bank',
    });
    try {
      // Persist bank fields first so the API has current values
      try {
        await persistPartial({
          bank_name: form.bank_name ?? null,
          account_name: form.account_name ?? null,
          account_number: accountNumber,
          branch_code: branchCode,
          account_type: form.account_type || 'Current',
        });
      } catch {
        /* continue — API accepts body overrides */
      }

      const res = await fetch('/api/business/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          paystackReference,
          bankAccountNumber: accountNumber,
          bankBranchCode: branchCode,
          bankName: form.bank_name || undefined,
          bankAccountType: form.account_type || 'Current',
          accountName: form.account_name || undefined,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Bank verification failed');
      }
      if (data.profile) {
        setForm((prev) => ({
          ...prev,
          ...data.profile,
          bank_verification_status:
            data.profile?.bank_verification_status || data.status,
          bank_verified_at: data.profile?.bank_verified_at || prev.bank_verified_at,
          metadata: data.profile?.metadata || prev.metadata,
        }));
      } else if (data.status) {
        setForm((prev) => ({
          ...prev,
          bank_verification_status: data.status,
          bank_verified_at:
            data.status === 'verified' ? new Date().toISOString() : prev.bank_verified_at,
        }));
      }
      setBankVerifyResult({
        status: data.status,
        message: data.message,
        verification: data.verification,
      });
      toast.success(data.message || 'Bank account verified via VerifyNow', {
        id: 'vn-bank',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bank verification failed', {
        id: 'vn-bank',
      });
    } finally {
      setBankVerifying(false);
      setBankPaying(false);
    }
  };

  /**
   * Pay R50 via Paystack, then VerifyNow bank-account-verification.
   */
  const startBankVerifyPayment = () => {
    const accountNumber = String(form.account_number || '').replace(/\s/g, '');
    const branchCode = String(form.branch_code || '').replace(/\s/g, '');
    if (!accountNumber) {
      toast.error('Add a bank account number before verifying.');
      return;
    }
    if (!/^\d{6}$/.test(branchCode)) {
      toast.error('Add a valid 6-digit branch code before verifying.');
      return;
    }
    if (!bankVerifyConsent) {
      toast.error('Confirm consent before paying for bank verification.');
      return;
    }
    const hasCompanyId = Boolean(String(form.registration_number || '').trim());
    const hasDirectorId = Boolean(String(form.director_id_number || '').replace(/\s/g, ''));
    if (!hasCompanyId && !hasDirectorId) {
      toast.error(
        'Add a CIPC registration number or director SA ID (for identity match) before verifying.'
      );
      return;
    }
    if (!String(form.account_name || form.legal_name || form.trading_name || '').trim()) {
      toast.error('Add an account name (or company legal name) before verifying.');
      return;
    }

    const email = String(form.email || user?.email?.address || '').trim();
    if (!email) {
      toast.error('Add a company email before paying for bank verification');
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error(
        'Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to enable R50 bank verification.'
      );
      return;
    }
    if (!window.PaystackPop) {
      toast.error('Paystack is still loading — try again in a moment');
      return;
    }

    setBankPaying(true);
    const ref = `sa-bank-verify-${companyId}-${Date.now()}`;
    try {
      const handler = window.PaystackPop.setup({
        key,
        email,
        amount: BANK_VERIFY_AMOUNT_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          custom_fields: [
            {
              display_name: 'Company ID',
              variable_name: 'company_id',
              value: String(companyId),
            },
            {
              display_name: 'Purpose',
              variable_name: 'purpose',
              value: 'verifynow_bank_verification',
            },
            {
              display_name: 'Amount ZAR',
              variable_name: 'amount_zar',
              value: String(BANK_VERIFY_AMOUNT_ZAR),
            },
          ],
        },
        callback: (response: { reference?: string }) => {
          void runBankVerifyNow(response.reference || ref);
        },
        onClose: () => {
          setBankPaying(false);
        },
      });
      handler.openIframe();
    } catch (e: unknown) {
      setBankPaying(false);
      toast.error(e instanceof Error ? e.message : 'Could not open Paystack');
    }
  };

  /**
   * Single path: Pay R69 via on-page Paystack, then VerifyNow CIPC.
   * Users never leave SupplierAdvisor for VerifyNow.
   */
  const startVerifyPayment = () => {
    if (!registrationForVerify && !vatForVerify) {
      toast.error('Add a CIPC registration number (or VAT number) before verifying.');
      return;
    }
    if (!verifyConsent) {
      toast.error('Confirm consent before paying for verification.');
      return;
    }

    const email = String(form.email || user?.email?.address || '').trim();
    if (!email) {
      toast.error('Add a company email before paying for verification');
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error(
        'Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to enable R69 verification.'
      );
      return;
    }
    if (!window.PaystackPop) {
      toast.error('Paystack is still loading — try again in a moment');
      return;
    }

    setPaying(true);
    const ref = `sa-verify-${companyId}-${Date.now()}`;
    try {
      const handler = window.PaystackPop.setup({
        key,
        email,
        amount: VERIFY_AMOUNT_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          custom_fields: [
            {
              display_name: 'Company ID',
              variable_name: 'company_id',
              value: String(companyId),
            },
            {
              display_name: 'Purpose',
              variable_name: 'purpose',
              value: 'verifynow_company_verification',
            },
            {
              display_name: 'Amount ZAR',
              variable_name: 'amount_zar',
              value: String(VERIFY_AMOUNT_ZAR),
            },
          ],
        },
        callback: (response: { reference?: string }) => {
          void runVerifyNow(response.reference || ref);
        },
        onClose: () => {
          setPaying(false);
        },
      });
      handler.openIframe();
    } catch (e: unknown) {
      setPaying(false);
      toast.error(e instanceof Error ? e.message : 'Could not open Paystack');
    }
  };

  if (loading) {
    return (
      <BusinessPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </BusinessPage>
    );
  }

  const isVerified =
    form.is_verified || form.verification_status === 'verified';
  const verificationStatus = String(form.verification_status || '').toLowerCase();
  const metaVerification =
    form.metadata &&
    typeof form.metadata === 'object' &&
    (form.metadata as { verification?: Record<string, unknown> }).verification
      ? ((form.metadata as { verification: Record<string, unknown> }).verification)
      : null;
  type DisplayVerification = {
    companyName?: string;
    tradeName?: string;
    registrationNumber?: string;
    companyStatus?: string;
    companyType?: string;
    physicalAddress?: string;
    vatNumber?: string;
    taxNumber?: string;
    directorCount?: string;
    nameMatch?: string;
    requestId?: string;
    statusText?: string;
  };

  const asDisplayField = (v: unknown): string | undefined => {
    if (v == null || v === '') return undefined;
    return String(v);
  };

  const displayVerification: DisplayVerification | null = verifyResult?.verification
    ? {
        companyName: asDisplayField(verifyResult.verification.companyName),
        tradeName: asDisplayField(verifyResult.verification.tradeName),
        registrationNumber: asDisplayField(verifyResult.verification.registrationNumber),
        companyStatus: asDisplayField(verifyResult.verification.companyStatus),
        companyType: asDisplayField(verifyResult.verification.companyType),
        physicalAddress: asDisplayField(verifyResult.verification.physicalAddress),
        vatNumber: asDisplayField(verifyResult.verification.vatNumber),
        taxNumber: asDisplayField(verifyResult.verification.taxNumber),
        directorCount: asDisplayField(verifyResult.verification.directorCount),
        nameMatch: asDisplayField(verifyResult.verification.nameMatch),
        requestId: asDisplayField(verifyResult.verification.requestId),
        statusText: asDisplayField(verifyResult.verification.statusText),
      }
    : metaVerification
      ? {
          companyName: asDisplayField(metaVerification.company_name),
          tradeName: asDisplayField(metaVerification.trade_name),
          registrationNumber: asDisplayField(metaVerification.registration_number),
          companyStatus: asDisplayField(metaVerification.company_status),
          companyType: asDisplayField(metaVerification.company_type),
          physicalAddress: asDisplayField(metaVerification.physical_address),
          vatNumber: asDisplayField(metaVerification.vat_number),
          taxNumber: asDisplayField(metaVerification.tax_number),
          directorCount: asDisplayField(metaVerification.director_count),
          nameMatch: asDisplayField(metaVerification.name_match),
          requestId: asDisplayField(metaVerification.request_id),
          statusText: asDisplayField(metaVerification.company_status),
        }
      : null;

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company"
        titleAccent="profile"
        description="Identity, contacts, banking, and certifications — full profiles row from Supabase (legacy + modern columns)."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save profile
              </>
            )}
          </button>
        }
      />

      {warning && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Profile loaded with a membership warning (data still shown): {warning}
          </span>
        </div>
      )}

      {/* Completeness + logo strip */}
      <div className="mb-6 rounded-[1.35rem] border border-neutral-200/90 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-14 w-14 rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center shrink-0">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(form.logo_url)}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-neutral-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 tracking-tight truncate">
                {form.trading_name || 'Your company'}
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {[form.industry, form.city, form.country].filter(Boolean).join(' · ') ||
                  'Complete your profile'}
              </div>
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Completeness
            </div>
            <div className="text-2xl font-black tracking-tighter tabular-nums">
              {completeness?.pct ?? 0}%
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mt-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6]"
            style={{ width: `${completeness?.pct ?? 0}%` }}
          />
        </div>
        {isVerified && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified company
          </div>
        )}
        {form.public_id && (
          <div className="mt-2 text-[11px] text-neutral-400 font-mono">
            public_id: {String(form.public_id)}
          </div>
        )}
      </div>

      {/* VerifyNow CIPC — Pay R69 via Paystack, then verify in-page (no free path) */}
      <Panel className="mb-6" title="Company verification">
        <div className="p-5 space-y-4">
          <p className="text-sm text-neutral-600 leading-relaxed">
            Run a live <strong>CIPC company check</strong> through VerifyNow without leaving
            SupplierAdvisor. We use your registration number (or VAT number) from this profile.
            Verification costs <strong>R{VERIFY_AMOUNT_ZAR}</strong> per check, paid securely via
            on-page Paystack checkout — payment is required for every verification.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Registration no.
              </div>
              <div className="text-sm font-mono text-slate-800 mt-0.5 truncate">
                {registrationForVerify || (
                  <span className="text-amber-700 font-sans text-xs">
                    Fill Identity → Registration no. first
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Status
              </div>
              <div className="mt-0.5">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    {form.verified_at
                      ? ` · ${new Date(String(form.verified_at)).toLocaleDateString()}`
                      : ''}
                  </span>
                ) : verificationStatus === 'mismatch' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> Name mismatch — review
                  </span>
                ) : verificationStatus === 'failed' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> Failed
                  </span>
                ) : verificationStatus === 'pending' ? (
                  <span className="text-xs font-semibold text-sky-700">Pending…</span>
                ) : (
                  <span className="text-xs font-semibold text-neutral-500">Unverified</span>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
              checked={verifyConsent}
              onChange={(e) => setVerifyConsent(e.target.checked)}
            />
            <span className="text-xs text-neutral-600 leading-relaxed">
              I confirm this company authorises a CIPC registration check via VerifyNow (data
              processed for KYB / FICA-style business verification). The check runs on this page
              — you will not be redirected.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                verifying ||
                paying ||
                !verifyConsent ||
                (!registrationForVerify && !vatForVerify)
              }
              onClick={startVerifyPayment}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              {paying || verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />{' '}
                  {isVerified
                    ? `Pay R${VERIFY_AMOUNT_ZAR} & re-verify`
                    : `Pay R${VERIFY_AMOUNT_ZAR} & verify`}
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            R{VERIFY_AMOUNT_ZAR}.00 ZAR charged via Paystack for each CIPC verification.
          </p>

          {displayVerification &&
            (displayVerification.companyName || displayVerification.registrationNumber) && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <Building2 className="w-4 h-4" />
                  CIPC result
                  {verifyResult?.status === 'verified' || isVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : null}
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {displayVerification.companyName ? (
                    <>
                      <dt className="text-neutral-500">Legal name</dt>
                      <dd className="font-semibold text-slate-800">
                        {String(displayVerification.companyName)}
                      </dd>
                    </>
                  ) : null}
                  {displayVerification.tradeName ? (
                    <>
                      <dt className="text-neutral-500">Trade name</dt>
                      <dd className="text-slate-700">{String(displayVerification.tradeName)}</dd>
                    </>
                  ) : null}
                  {displayVerification.registrationNumber ? (
                    <>
                      <dt className="text-neutral-500">Registration</dt>
                      <dd className="font-mono text-slate-800">
                        {String(displayVerification.registrationNumber)}
                      </dd>
                    </>
                  ) : null}
                  {displayVerification.companyStatus ? (
                    <>
                      <dt className="text-neutral-500">CIPC status</dt>
                      <dd className="font-semibold text-slate-800">
                        {String(displayVerification.companyStatus)}
                      </dd>
                    </>
                  ) : null}
                  {displayVerification.companyType ? (
                    <>
                      <dt className="text-neutral-500">Type</dt>
                      <dd className="text-slate-700">{String(displayVerification.companyType)}</dd>
                    </>
                  ) : null}
                  {displayVerification.physicalAddress ? (
                    <>
                      <dt className="text-neutral-500">Registered address</dt>
                      <dd className="text-slate-700">
                        {String(displayVerification.physicalAddress)}
                      </dd>
                    </>
                  ) : null}
                  {displayVerification.directorCount ? (
                    <>
                      <dt className="text-neutral-500">Directors</dt>
                      <dd className="text-slate-700">{String(displayVerification.directorCount)}</dd>
                    </>
                  ) : null}
                  {displayVerification.nameMatch &&
                  displayVerification.nameMatch !== 'unknown' ? (
                    <>
                      <dt className="text-neutral-500">Name match</dt>
                      <dd
                        className={
                          displayVerification.nameMatch === 'mismatch'
                            ? 'font-semibold text-amber-800'
                            : 'text-slate-700'
                        }
                      >
                        {String(displayVerification.nameMatch)}
                      </dd>
                    </>
                  ) : null}
                </dl>
                {verifyResult?.message && (
                  <p className="text-[11px] text-emerald-900/80 pt-1">{verifyResult.message}</p>
                )}
                {displayVerification.requestId ? (
                  <p className="text-[10px] text-neutral-400 font-mono pt-1">
                    requestId: {String(displayVerification.requestId)}
                  </p>
                ) : null}
              </div>
            )}

          {form.verification_payment_ref && (
            <p className="text-[11px] text-neutral-400 font-mono">
              Payment ref: {String(form.verification_payment_ref)}
            </p>
          )}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Identity */}
        <Panel title="Identity">
          <div className="p-5 space-y-3">
            <Field label="Trading name *">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.trading_name || ''}
                onChange={(e) => set('trading_name', e.target.value)}
              />
            </Field>
            <Field label="Legal name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.legal_name || ''}
                onChange={(e) => set('legal_name', e.target.value)}
              />
            </Field>
            <Field label="Business type">
              <select
                className="input w-full !p-3 !text-sm"
                value={form.business_type || form.category || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  set('business_type', v);
                  set('category', v);
                }}
              >
                <option value="">Select business type…</option>
                {/* Preserve legacy free-text values not in the list */}
                {(() => {
                  const current = String(form.business_type || form.category || '');
                  if (
                    current &&
                    !BUSINESS_TYPE_OPTIONS.includes(
                      current as (typeof BUSINESS_TYPE_OPTIONS)[number]
                    )
                  ) {
                    return <option value={current}>{current}</option>;
                  }
                  return null;
                })()}
                {BUSINESS_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Registration no.">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.registration_number || ''}
                onChange={(e) => set('registration_number', e.target.value)}
              />
            </Field>
            <FileUploadField
              label="Company registration document"
              url={form.registration_certificate_url}
              uploading={uploading === 'registration'}
              onFile={(f) =>
                void handleUpload(
                  f,
                  'registration',
                  (url) => set('registration_certificate_url', url),
                  'registration_certificate_url'
                )
              }
              onClear={() => {
                set('registration_certificate_url', null);
                void persistPartial({ registration_certificate_url: null }).catch(() => undefined);
              }}
            />
            <Field label="VAT number">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.vat_number || ''}
                onChange={(e) => set('vat_number', e.target.value)}
              />
            </Field>
            <FileUploadField
              label="VAT certificate"
              url={form.vat_certificate_url}
              uploading={uploading === 'vat'}
              onFile={(f) =>
                void handleUpload(
                  f,
                  'vat',
                  (url) => set('vat_certificate_url', url),
                  'vat_certificate_url'
                )
              }
              onClear={() => {
                set('vat_certificate_url', null);
                void persistPartial({ vat_certificate_url: null }).catch(() => undefined);
              }}
            />
            <Field label="About / short description">
              <textarea
                className="input w-full !p-3 !text-sm min-h-[88px]"
                value={String(
                  form.description || form.short_description || form.about || ''
                )}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this company do?"
              />
            </Field>
            <FileUploadField
              label="Company logo"
              url={form.logo_url}
              accept="image/*"
              uploading={uploading === 'logo'}
              previewImage
              onFile={(f) =>
                void handleUpload(f, 'logo', (url) => set('logo_url', url), 'logo_url')
              }
              onClear={() => {
                set('logo_url', null);
                void persistPartial({ logo_url: null }).catch(() => undefined);
              }}
            />
          </div>
        </Panel>

        {/* Contacts */}
        <Panel title="Contacts">
          <div className="p-5 space-y-3">
            <Field label="Primary contact">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.contact_name || ''}
                onChange={(e) => set('contact_name', e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input w-full !p-3 !text-sm"
                value={form.email || ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={
                    form.contact_phone || form.contact_number || form.phone || ''
                  }
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Website">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.website || ''}
                  onChange={(e) => set('website', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Wallet address (on-chain)">
              <div className="relative">
                <input
                  className="input w-full !p-3 !text-sm font-mono pr-10"
                  value={form.wallet_address || loginWallet || ''}
                  onChange={(e) => set('wallet_address', e.target.value)}
                  placeholder="0x…"
                />
                <Wallet className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              {loginWallet && (
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  From login credentials
                  {form.wallet_address &&
                  form.wallet_address.toLowerCase() !== loginWallet.toLowerCase()
                    ? ' (profile override saved)'
                    : ' · auto-filled when empty'}
                  :{' '}
                  <span className="font-mono text-neutral-600">
                    {loginWallet.slice(0, 6)}…{loginWallet.slice(-4)}
                  </span>
                  {(!form.wallet_address ||
                    form.wallet_address.toLowerCase() !== loginWallet.toLowerCase()) && (
                    <button
                      type="button"
                      className="ml-2 text-[#00b4d8] font-semibold hover:underline"
                      onClick={() => set('wallet_address', loginWallet)}
                    >
                      Use login wallet
                    </button>
                  )}
                </p>
              )}
              {!loginWallet && (
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  No on-chain wallet linked to this login yet — paste an address if you have one.
                </p>
              )}
            </Field>
          </div>
        </Panel>

        {/* Location */}
        <Panel title="Location">
          <div className="p-5 space-y-4">
            <GeoSelectFields value={geo} onChange={onGeoChange} />
            <Field label="Street address">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.street || form.address || ''}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field label="Postal code">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.postal_code || ''}
                onChange={(e) => set('postal_code', e.target.value)}
              />
            </Field>

            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-2">
                <MapPin className="w-3.5 h-3.5 text-[#00b4d8]" /> Drop a pin
              </div>
              <p className="text-[11px] text-neutral-500 mb-2">
                Click the map to set company GPS coordinates.
              </p>
              <div className="relative z-0 h-64 min-h-[256px] w-full rounded-3xl overflow-hidden border border-neutral-200 bg-slate-100 isolate">
                <LocationMap
                  onMapClick={(lat, lng) => {
                    setForm((p) => ({
                      ...p,
                      latitude: Number(lat.toFixed(6)),
                      longitude: Number(lng.toFixed(6)),
                      lat: Number(lat.toFixed(6)),
                      lng: Number(lng.toFixed(6)),
                    }));
                  }}
                  selectedPosition={mapPos}
                  center={mapPos || [-29.0, 24.5]}
                  zoom={mapPos ? 12 : 5}
                  height="256px"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Latitude">
                  <input
                    className="input w-full !p-3 !text-sm font-mono"
                    value={form.latitude ?? form.lat ?? ''}
                    onChange={(e) => {
                      set('latitude', e.target.value);
                      set('lat', e.target.value);
                    }}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    className="input w-full !p-3 !text-sm font-mono"
                    value={form.longitude ?? form.lng ?? ''}
                    onChange={(e) => {
                      set('longitude', e.target.value);
                      set('lng', e.target.value);
                    }}
                  />
                </Field>
              </div>
            </div>
          </div>
        </Panel>

        {/* Industry & compliance */}
        <Panel title="Industry & compliance">
          <div className="p-5 space-y-4">
            <div>
              <SectionLabel>Industry (multi-select)</SectionLabel>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMPANY_INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndustry(ind)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                      selectedIndustries.includes(ind)
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Sub-industry (multi-select)</SectionLabel>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-40 overflow-y-auto">
                {subIndustryOptions.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubIndustry(sub)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                      selectedSubIndustries.includes(sub)
                        ? 'border-[#0077b6] bg-[#0077b6]/10 text-[#0077b6]'
                        : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </Panel>

        {/* Certifications */}
        <Panel title="Certifications & other">
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="B-BBEE level">
                <select
                  className="input w-full !p-3 !text-sm"
                  value={form.bee_level || ''}
                  onChange={(e) => set('bee_level', e.target.value)}
                >
                  <option value="">Select…</option>
                  {BEE.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:pt-0">
                <FileUploadField
                  label="BEE certificate"
                  url={form.bee_certificate_url}
                  uploading={uploading === 'bee'}
                  onFile={(f) =>
                    void handleUpload(
                      f,
                      'bee',
                      (url) => set('bee_certificate_url', url),
                      'bee_certificate_url'
                    )
                  }
                  onClear={() => {
                    set('bee_certificate_url', null);
                    void persistPartial({ bee_certificate_url: null }).catch(() => undefined);
                  }}
                />
              </div>
            </div>

            <SectionLabel>Quick select</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {CERTS_PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => togglePresetCert(c)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    certEntries.some((x) => x.name === c)
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <SectionLabel>Certificates (name · dates · file)</SectionLabel>
              <button
                type="button"
                onClick={addCustomCert}
                className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="space-y-3">
              {certEntries.length === 0 && (
                <p className="text-xs text-neutral-400">
                  No certifications yet — pick presets or add custom.
                </p>
              )}
              {certEntries.map((c, idx) => (
                <div
                  key={`${c.name}-${idx}`}
                  className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 !p-2.5 !text-sm"
                      placeholder="Certificate name"
                      value={c.name}
                      onChange={(e) => updateCert(idx, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeCert(idx)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove certification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Awarded">
                      <input
                        type="date"
                        className="input w-full !p-2.5 !text-sm"
                        value={c.awarded_date || ''}
                        onChange={(e) => updateCert(idx, { awarded_date: e.target.value })}
                      />
                    </Field>
                    <Field label="Expiry (if any)">
                      <input
                        type="date"
                        className="input w-full !p-2.5 !text-sm"
                        value={c.expiry_date || ''}
                        onChange={(e) => updateCert(idx, { expiry_date: e.target.value })}
                      />
                    </Field>
                  </div>
                  <FileUploadField
                    label="Certificate file"
                    url={c.file_url}
                    compact
                    uploading={uploading === `cert-${idx}`}
                    onFile={(f) =>
                      void handleUpload(f, `cert-${idx}`, (url) => {
                        setCertEntries((prev) => {
                          const next = prev.map((entry, i) =>
                            i === idx ? { ...entry, file_url: url } : entry
                          );
                          const cleanCerts = next
                            .map((entry) => ({
                              name:
                                String(entry.name || '').trim() ||
                                (entry.file_url ? 'Certificate' : ''),
                              awarded_date: entry.awarded_date || null,
                              expiry_date: entry.expiry_date || null,
                              file_url: entry.file_url || null,
                            }))
                            .filter((entry) => entry.name || entry.file_url);
                          const names = cleanCerts.map((entry) => entry.name).filter(Boolean);
                          void persistPartial({
                            uploaded_certificates: cleanCerts,
                            certifications: names,
                            iso_certifications: names,
                          })
                            .then(() => toast.success('Certificate file saved to Supabase'))
                            .catch((err: unknown) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not sync certificate file — click Save'
                              )
                            );
                          return next;
                        });
                      })
                    }
                    onClear={() => {
                      setCertEntries((prev) => {
                        const next = prev.map((entry, i) =>
                          i === idx ? { ...entry, file_url: null } : entry
                        );
                        const cleanCerts = next
                          .map((entry) => ({
                            name:
                              String(entry.name || '').trim() ||
                              (entry.file_url ? 'Certificate' : ''),
                            awarded_date: entry.awarded_date || null,
                            expiry_date: entry.expiry_date || null,
                            file_url: entry.file_url || null,
                          }))
                          .filter((entry) => entry.name || entry.file_url);
                        const names = cleanCerts.map((entry) => entry.name).filter(Boolean);
                        void persistPartial({
                          uploaded_certificates: cleanCerts,
                          certifications: names,
                          iso_certifications: names,
                        }).catch(() => undefined);
                        return next;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Banking + VerifyNow AVS (R50) */}
        <Panel title="Banking">
          <div className="p-5 space-y-3">
            <Field label="Bank name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.bank_name || ''}
                onChange={(e) => set('bank_name', e.target.value)}
                placeholder="e.g. FNB, Standard Bank, Capitec"
              />
            </Field>
            <Field label="Account name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.account_name || ''}
                onChange={(e) => set('account_name', e.target.value)}
                placeholder="Name on the bank account"
              />
            </Field>
            <Field label="Account number">
              <input
                className="input w-full !p-3 !text-sm font-mono"
                value={form.account_number || ''}
                onChange={(e) => set('account_number', e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Branch code">
                <input
                  className="input w-full !p-3 !text-sm font-mono"
                  value={form.branch_code || ''}
                  onChange={(e) =>
                    set('branch_code', e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="6 digits e.g. 250655"
                  inputMode="numeric"
                  maxLength={6}
                />
              </Field>
              <Field label="Account type">
                <select
                  className="input w-full !p-3 !text-sm"
                  value={form.account_type || 'Current'}
                  onChange={(e) => set('account_type', e.target.value)}
                >
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IBAN">
                <input
                  className="input w-full !p-3 !text-sm font-mono"
                  value={form.iban || ''}
                  onChange={(e) => set('iban', e.target.value)}
                />
              </Field>
              <Field label="SWIFT / BIC">
                <input
                  className="input w-full !p-3 !text-sm font-mono"
                  value={form.swift || ''}
                  onChange={(e) => set('swift', e.target.value)}
                />
              </Field>
            </div>
            <FileUploadField
              label="Bank confirmation letter"
              url={form.bank_confirmation_url}
              uploading={uploading === 'bank'}
              onFile={(f) =>
                void handleUpload(
                  f,
                  'bank',
                  (url) => set('bank_confirmation_url', url),
                  'bank_confirmation_url'
                )
              }
              onClear={() => {
                set('bank_confirmation_url', null);
                void persistPartial({ bank_confirmation_url: null }).catch(() => undefined);
              }}
            />

            {/* VerifyNow bank AVS — Pay R50 via Paystack */}
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#00b4d8]" />
                    Bank account verification
                  </div>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    Confirm this account is open and belongs to your company (or director) via
                    VerifyNow AVS. Costs <strong>R{BANK_VERIFY_AMOUNT_ZAR}</strong> per check,
                    paid via Paystack — same pattern as CIPC company verification.
                  </p>
                </div>
                {String(form.bank_verification_status || bankVerifyResult?.status || '')
                  .toLowerCase() === 'verified' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                ) : String(form.bank_verification_status || bankVerifyResult?.status || '')
                    .toLowerCase() === 'failed' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Failed
                  </span>
                ) : null}
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-neutral-500">
                <div>
                  Identity used:{' '}
                  <span className="font-semibold text-slate-700">
                    {String(form.registration_number || '').trim()
                      ? `Company · ${form.registration_number}`
                      : String(form.director_id_number || '').trim()
                        ? 'Director SA ID'
                        : 'Add reg. no. or director ID'}
                  </span>
                </div>
                {form.bank_verified_at ? (
                  <div>
                    Last check:{' '}
                    <span className="font-semibold text-slate-700">
                      {new Date(String(form.bank_verified_at)).toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                  checked={bankVerifyConsent}
                  onChange={(e) => setBankVerifyConsent(e.target.checked)}
                />
                <span className="text-xs text-neutral-600 leading-relaxed">
                  I authorise a bank account ownership check via VerifyNow against the details
                  above (account number, branch, and company registration or director ID). The
                  check runs on this page after Paystack payment.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={
                    bankPaying ||
                    bankVerifying ||
                    !bankVerifyConsent ||
                    !String(form.account_number || '').trim() ||
                    !/^\d{6}$/.test(String(form.branch_code || '').replace(/\s/g, ''))
                  }
                  onClick={startBankVerifyPayment}
                  className="btn-primary !py-2.5 !px-5 text-sm"
                >
                  {bankPaying || bankVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />{' '}
                      {String(form.bank_verification_status || '').toLowerCase() === 'verified'
                        ? `Pay R${BANK_VERIFY_AMOUNT_ZAR} & re-verify`
                        : `Pay R${BANK_VERIFY_AMOUNT_ZAR} & verify bank`}
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                R{BANK_VERIFY_AMOUNT_ZAR}.00 ZAR charged via Paystack for each bank verification.
                Save branch code and account details first if you changed them.
              </p>

              {Boolean(
                bankVerifyResult?.verification &&
                  (bankVerifyResult.verification.summary ||
                    bankVerifyResult.verification.accountFound ||
                    bankVerifyResult.verification.statusText)
              ) ? (
                  <div
                    className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                      bankVerifyResult?.status === 'verified'
                        ? 'border-emerald-200/80 bg-emerald-50/50'
                        : 'border-amber-200/80 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Wallet className="w-3.5 h-3.5" />
                      VerifyNow result
                      {bankVerifyResult?.status === 'verified' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : null}
                    </div>
                    {bankVerifyResult?.message ? (
                      <p className="text-slate-700">{bankVerifyResult.message}</p>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {([
                        {
                          label: 'Summary',
                          value: String(bankVerifyResult?.verification?.summary ?? ''),
                        },
                        {
                          label: 'Account found',
                          value: String(bankVerifyResult?.verification?.accountFound ?? ''),
                        },
                        {
                          label: 'Account open',
                          value: String(bankVerifyResult?.verification?.accountOpen ?? ''),
                        },
                        {
                          label: 'Identity match',
                          value: String(bankVerifyResult?.verification?.identityMatch ?? ''),
                        },
                        {
                          label: 'Type match',
                          value: String(bankVerifyResult?.verification?.accountTypeMatch ?? ''),
                        },
                        {
                          label: 'Accepts credits',
                          value: String(bankVerifyResult?.verification?.acceptsCredits ?? ''),
                        },
                        {
                          label: 'Accepts debits',
                          value: String(bankVerifyResult?.verification?.acceptsDebits ?? ''),
                        },
                        {
                          label: 'Request ID',
                          value: String(bankVerifyResult?.verification?.requestId ?? ''),
                        },
                      ] satisfies Array<{ label: string; value: string }>)
                        .filter((row) => row.value.trim().length > 0)
                        .map((row) => (
                          <div key={row.label} className="contents">
                            <dt className="text-neutral-500">{row.label}</dt>
                            <dd className="font-semibold text-slate-800">{row.value}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ) : null}
            </div>
          </div>
        </Panel>

        {/* Licenses & director */}
        <Panel title="Licenses & director">
          <div className="p-5 space-y-4">
            <Field label="Director ID number">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.director_id_number || ''}
                onChange={(e) => set('director_id_number', e.target.value)}
              />
            </Field>

            <Field label="Import license no.">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.import_license_number || ''}
                onChange={(e) => set('import_license_number', e.target.value)}
              />
            </Field>
            <FileUploadField
              label="Import license document"
              url={form.import_license_url}
              uploading={uploading === 'import'}
              onFile={(f) =>
                void handleUpload(
                  f,
                  'import',
                  (url) => set('import_license_url', url),
                  'import_license_url'
                )
              }
              onClear={() => {
                set('import_license_url', null);
                void persistPartial({ import_license_url: null }).catch(() => undefined);
              }}
            />

            <div className="flex items-center justify-between pt-1">
              <SectionLabel>Export licenses (per country)</SectionLabel>
              <button
                type="button"
                onClick={addExportLicense}
                className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add country
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 -mt-2">
              Export licences often apply per destination country — add one row per country.
            </p>

            {exportLicenses.length === 0 && (
              <p className="text-xs text-neutral-400">No export licenses yet.</p>
            )}
            <div className="space-y-3">
              {exportLicenses.map((lic, idx) => (
                <div
                  key={`exp-${idx}`}
                  className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 !p-2.5 !text-sm"
                      placeholder="Country"
                      value={lic.country}
                      onChange={(e) => updateExport(idx, { country: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeExport(idx)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove export license"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <Field label="License number">
                    <input
                      className="input w-full !p-2.5 !text-sm"
                      value={lic.license_number || ''}
                      onChange={(e) =>
                        updateExport(idx, { license_number: e.target.value })
                      }
                    />
                  </Field>
                  <FileUploadField
                    label="Export license file"
                    url={lic.file_url}
                    compact
                    uploading={uploading === `export-${idx}`}
                    onFile={(f) =>
                      void handleUpload(f, `export-${idx}`, (url) => {
                        setExportLicenses((prev) => {
                          const next = prev.map((entry, i) =>
                            i === idx ? { ...entry, file_url: url } : entry
                          );
                          const cleanExports = next
                            .map((entry) => ({
                              country: String(entry.country || '').trim(),
                              license_number: entry.license_number || null,
                              file_url: entry.file_url || null,
                            }))
                            .filter((entry) => entry.country);
                          const first = cleanExports[0];
                          void persistPartial({
                            export_licenses: cleanExports,
                            export_license_number: first?.license_number || null,
                            export_license_url: first?.file_url || null,
                          }).catch(() => undefined);
                          return next;
                        });
                      })
                    }
                    onClear={() => {
                      setExportLicenses((prev) => {
                        const next = prev.map((entry, i) =>
                          i === idx ? { ...entry, file_url: null } : entry
                        );
                        const cleanExports = next
                          .map((entry) => ({
                            country: String(entry.country || '').trim(),
                            license_number: entry.license_number || null,
                            file_url: entry.file_url || null,
                          }))
                          .filter((entry) => entry.country);
                        const first = cleanExports[0];
                        void persistPartial({
                          export_licenses: cleanExports,
                          export_license_number: first?.license_number || null,
                          export_license_url: first?.file_url || null,
                        }).catch(() => undefined);
                        return next;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary !py-3 !px-8 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save to Supabase'}
        </button>
      </div>
    </BusinessPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FileUploadField({
  label,
  url,
  onFile,
  onClear,
  uploading,
  accept = 'application/pdf,image/*,.doc,.docx',
  previewImage = false,
  compact = false,
}: {
  label: string;
  url?: string | null;
  onFile: (file: File | null) => void;
  onClear?: () => void;
  uploading?: boolean;
  accept?: string;
  previewImage?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </label>
      <div
        className={`mt-1 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 ${
          compact ? 'p-2.5' : 'p-3'
        }`}
      >
        {url ? (
          <div className="flex items-center gap-3">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(url)}
                alt=""
                className="h-12 w-12 rounded-xl object-contain bg-white border border-neutral-100"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[#00b4d8]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <a
                href={String(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#00b4d8] hover:underline truncate block"
              >
                View file
              </a>
              <p className="text-[10px] text-neutral-400 truncate font-mono">{String(url)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <label className="cursor-pointer text-[11px] font-semibold text-neutral-600 px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-neutral-200">
                Replace
                <input
                  type="file"
                  accept={accept}
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
              </label>
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="cursor-pointer flex items-center gap-2 text-xs text-neutral-600">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#00b4d8]" />
            ) : (
              <Upload className="w-4 h-4 text-[#00b4d8]" />
            )}
            <span>{uploading ? 'Uploading…' : 'Click to upload PDF or image'}</span>
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploading}
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
