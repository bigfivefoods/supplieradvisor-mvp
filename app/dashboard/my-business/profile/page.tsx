'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import SearchVisibilityCard from '@/components/business/SearchVisibilityCard';

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
  /** Snapshot at Paystack open — callback must not depend on re-renders */
  const bankVerifyInFlightRef = useRef(false);
  const bankVerifyPayloadRef = useRef<{
    accountNumber: string;
    branchCode: string;
    bankName: string;
    accountType: string;
    accountName: string;
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

      // Soft backfill continent from country when missing (server also derives on save)
      if (profile.country && !profile.continent) {
        void fetch('/api/business/location-backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, privyUserId }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.updated && d.continent) {
              setForm((prev) => ({
                ...prev,
                country: d.country || prev.country,
                continent: d.continent,
              }));
              setGeo((g) => ({
                ...g,
                country: String(d.country || g.country || ''),
                continent: String(d.continent || g.continent || ''),
              }));
            }
          })
          .catch(() => undefined);
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
      let uploadFile = file;
      if (kind === 'logo' || persistField === 'logo_url') {
        const { ensurePdfFriendlyLogoFile } = await import(
          '@/lib/business/logo-for-pdf'
        );
        const prepared = await ensurePdfFriendlyLogoFile(file);
        uploadFile = prepared.file;
        if (prepared.converted) {
          toast.success('Logo converted to PNG for PDF quotes & invoices');
        } else if (prepared.warning) {
          toast.message('Logo format tip', {
            description: prepared.warning,
            duration: 8000,
          });
        }
      }

      const result = await uploadCompanyAssetServerFirst({
        file: uploadFile,
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

      // PDF quotes/invoices only embed PNG/JPEG — WebP/SVG show monogram only
      if (
        kind === 'logo' ||
        persistField === 'logo_url'
      ) {
        const lower = `${file.name} ${result.url}`.toLowerCase();
        if (
          lower.includes('.webp') ||
          lower.includes('.svg') ||
          file.type === 'image/webp' ||
          file.type === 'image/svg+xml'
        ) {
          toast.message('Logo format tip for PDFs', {
            description:
              'Use PNG or JPEG for quotes & invoices. WebP/SVG cannot be embedded in the PDF (a monogram is used instead).',
            duration: 9000,
          });
        }
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
   * Pass reusePayment to re-run CIPC with stored Paystack ref (no second charge).
   */
  const runVerifyNow = async (
    paystackReference: string | null,
    opts?: { reusePayment?: boolean }
  ) => {
    if (!opts?.reusePayment && !paystackReference?.trim()) {
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
    toast.loading(
      opts?.reusePayment
        ? 'Re-running CIPC with your previous payment…'
        : 'Payment received — verifying with VerifyNow (CIPC)…',
      { id: 'vn-company' }
    );
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          registrationNumber: registrationForVerify || undefined,
          vatNumber: vatForVerify || undefined,
          ...(paystackReference ? { paystackReference } : {}),
          reusePayment: opts?.reusePayment === true,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'VerifyNow verification failed');
      }
      applyVerifyResponse(data);
      const credits =
        data.verification?.remainingCredits != null
          ? Number(data.verification.remainingCredits)
          : null;
      toast.success(
        credits != null && Number.isFinite(credits)
          ? `${data.message || 'Company verified'} · VerifyNow credits left: ${credits}`
          : data.message || 'Company verified via VerifyNow',
        { id: 'vn-company' }
      );
      if (credits != null && credits < 20) {
        toast.message('VerifyNow credits running low — top up at verifynow.co.za', {
          duration: 6000,
        });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verification failed', {
        id: 'vn-company',
      });
    } finally {
      setVerifying(false);
      setPaying(false);
    }
  };

  /** Re-run CIPC using stored Paystack reference (no second R69). */
  const rerunCipcReusePayment = () => {
    if (!verifyConsent) {
      toast.error('Confirm consent before re-running CIPC.');
      return;
    }
    void runVerifyNow(null, { reusePayment: true });
  };

  /**
   * If payment + CIPC already ran but badge never stuck (schema bug),
   * promote verification_status from metadata snapshot.
   */
  const recoverVerifiedFromMetadata = async () => {
    setVerifying(true);
    toast.loading('Applying verified badge from last CIPC result…', {
      id: 'vn-recover',
    });
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'apply_from_metadata',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Recovery failed');
      }
      applyVerifyResponse(data);
      toast.success(data.message || 'Verified badge applied', { id: 'vn-recover' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Recovery failed', {
        id: 'vn-recover',
      });
    } finally {
      setVerifying(false);
    }
  };

  /** Copy CIPC company name onto trading + legal name, then re-run CIPC if paid. */
  const applyCipcNameToProfile = async () => {
    const fromLive = verifyResult?.verification?.companyName;
    const fromMeta =
      form.metadata &&
      typeof form.metadata === 'object' &&
      (form.metadata as { verification?: { company_name?: string } }).verification
        ?.company_name;
    const cipcName = String(fromLive || fromMeta || '').trim();
    if (!cipcName) {
      toast.error('No CIPC company name available yet — run verify first.');
      return;
    }
    setSaving(true);
    try {
      setForm((prev) => ({
        ...prev,
        trading_name: cipcName,
        legal_name: cipcName,
      }));
      await persistPartial({
        trading_name: cipcName,
        legal_name: cipcName,
      });
      toast.success(`Profile names set to “${cipcName}”`);
      // Re-run CIPC with stored payment if we have consent
      if (verifyConsent) {
        void runVerifyNow(null, { reusePayment: true });
      } else {
        toast.message('Tick consent, then Re-run CIPC to finish verification.');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not update names');
    } finally {
      setSaving(false);
    }
  };

  /**
   * After R50 Paystack payment, run VerifyNow bank AVS — same pattern as CIPC.
   * Payload is snapshotted at Paystack open so the callback is stable.
   */
  const runBankVerifyNow = async (paystackReference: string) => {
    if (!paystackReference?.trim()) {
      toast.error('Payment is required before bank verification (R50).');
      setBankPaying(false);
      return;
    }

    const snap = bankVerifyPayloadRef.current;
    const accountNumber =
      snap?.accountNumber || String(form.account_number || '').replace(/\s/g, '');
    const branchCode =
      snap?.branchCode || String(form.branch_code || '').replace(/\s/g, '');
    const bankName = snap?.bankName || String(form.bank_name || '').trim();
    const accountType =
      snap?.accountType || String(form.account_type || 'Current').trim() || 'Current';
    const accountName = snap?.accountName || String(form.account_name || '').trim();

    if (!accountNumber || !/^\d{6}$/.test(branchCode)) {
      toast.error('Missing bank account number or 6-digit branch code.');
      setBankPaying(false);
      setBankVerifying(false);
      return;
    }

    bankVerifyInFlightRef.current = true;
    setBankVerifying(true);
    toast.loading('Payment received — verifying bank account with VerifyNow…', {
      id: 'vn-bank',
    });

    try {
      const res = await fetch('/api/business/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          paystackReference,
          bankAccountNumber: accountNumber,
          bankBranchCode: branchCode,
          bankName: bankName || undefined,
          bankAccountType: accountType,
          accountName: accountName || undefined,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || data.hint || `Bank verification failed (${res.status})`
        );
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
            data.status === 'verified'
              ? new Date().toISOString()
              : prev.bank_verified_at,
        }));
      }
      setBankVerifyResult({
        status: data.status,
        message: data.message,
        verification: data.verification,
      });
      const bankCredits =
        data.verification?.remainingCredits != null
          ? Number(data.verification.remainingCredits)
          : null;
      toast.success(
        bankCredits != null && Number.isFinite(bankCredits)
          ? `${data.message || 'Bank verified'} · VerifyNow credits left: ${bankCredits}`
          : data.message || 'Bank account verified via VerifyNow',
        { id: 'vn-bank' }
      );
      if (bankCredits != null && bankCredits < 20) {
        toast.message('VerifyNow credits running low — top up at verifynow.co.za', {
          duration: 6000,
        });
      }
    } catch (e: unknown) {
      console.error('runBankVerifyNow failed:', e);
      toast.error(e instanceof Error ? e.message : 'Bank verification failed', {
        id: 'vn-bank',
        duration: 8000,
      });
    } finally {
      setBankVerifying(false);
      setBankPaying(false);
      bankVerifyInFlightRef.current = false;
    }
  };

  /**
   * Same flow as CIPC company verify: open Paystack R50 → on success call VerifyNow.
   * Validations toast on click (button is never silently disabled for missing fields).
   */
  const startBankVerifyPayment = () => {
    const accountNumber = String(form.account_number || '').replace(/\s/g, '');
    const branchCode = String(form.branch_code || '').replace(/\s/g, '');

    if (!bankVerifyConsent) {
      toast.error('Tick the consent box before verifying the bank account.');
      return;
    }
    if (!accountNumber) {
      toast.error('Enter the bank account number first.');
      return;
    }
    if (!/^\d{6}$/.test(branchCode)) {
      toast.error(
        'Enter a valid 6-digit branch code (e.g. FNB 250655, Capitec 470010).'
      );
      return;
    }
    const hasCompanyId = Boolean(String(form.registration_number || '').trim());
    const hasDirectorId = Boolean(
      String(form.director_id_number || '').replace(/\s/g, '')
    );
    if (!hasCompanyId && !hasDirectorId) {
      toast.error(
        'Add a company registration number (Identity) or director SA ID (Licenses & director) first — VerifyNow needs an identity to match the account.'
      );
      return;
    }
    const accountName = String(
      form.account_name || form.legal_name || form.trading_name || ''
    ).trim();
    if (!accountName) {
      toast.error('Enter the account name (name on the bank account).');
      return;
    }

    const email = String(form.email || user?.email?.address || '').trim();
    if (!email) {
      toast.error('Add a company email (Identity section) for Paystack checkout.');
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error(
        'Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.'
      );
      return;
    }
    if (!window.PaystackPop?.setup) {
      toast.error('Paystack is still loading — wait a second and try again.');
      return;
    }

    bankVerifyPayloadRef.current = {
      accountNumber,
      branchCode,
      bankName: String(form.bank_name || '').trim(),
      accountType: String(form.account_type || 'Current').trim() || 'Current',
      accountName,
    };

    setBankPaying(true);
    const ref = `sa-bank-${companyId}-${Date.now()}`;
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
          bankVerifyInFlightRef.current = true;
          void runBankVerifyNow(response.reference || ref);
        },
        onClose: () => {
          if (bankVerifyInFlightRef.current) return;
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

  const inputCls = 'input w-full !py-2 !px-2.5 !text-sm';
  const bankVerified =
    String(form.bank_verification_status || bankVerifyResult?.status || '').toLowerCase() ===
    'verified';
  const bankFailed =
    String(form.bank_verification_status || bankVerifyResult?.status || '').toLowerCase() ===
    'failed';

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company"
        titleAccent="profile"
        description="Identity, CIPC verification, contacts, banking, and compliance — saved to your company profile."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save
              </>
            )}
          </button>
        }
      />

      {warning && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Membership warning (data still shown): {warning}</span>
        </div>
      )}

      {/* CIPC name mismatch — fix without re-paying */}
      {!isVerified &&
        (verificationStatus === 'mismatch' ||
          String(displayVerification?.nameMatch || metaVerification?.name_match || '') ===
            'mismatch') &&
        (displayVerification?.companyName || metaVerification?.company_name) && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-bold text-sm">CIPC name does not match your profile</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/80 border border-amber-200/80 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase text-neutral-400">
                      On your profile
                    </div>
                    <div className="font-semibold text-slate-800 mt-0.5 truncate">
                      {form.trading_name || form.legal_name || '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-emerald-200 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase text-emerald-700/80">
                      From CIPC
                    </div>
                    <div className="font-semibold text-emerald-900 mt-0.5 truncate">
                      {String(
                        displayVerification?.companyName ||
                          metaVerification?.company_name ||
                          ''
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving || verifying}
                  onClick={() => void applyCipcNameToProfile()}
                  className="btn-primary !py-2 !px-3 text-xs"
                >
                  Use CIPC name on profile & re-run check
                </button>
                <p className="text-[10px] text-amber-900/80">
                  Uses your existing R69 payment when you re-run — no second charge if
                  payment is already stored.
                </p>
              </div>
            </div>
          </div>
        )}

      <nav
        className="sticky top-0 z-20 mb-3 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur"
        aria-label="Profile sections"
      >
        {[
          { id: 'identity', label: 'Identity & CIPC' },
          { id: 'contacts', label: 'Contacts' },
          { id: 'location', label: 'Location' },
          { id: 'industry', label: 'Industry' },
          { id: 'banking', label: 'Banking' },
          { id: 'licenses', label: 'Licenses' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-[#00b4d8]/10 hover:text-[#0077b6]"
            onClick={() =>
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Compact summary strip */}
      <div className="mb-4 rounded-2xl border border-neutral-200/90 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center shrink-0">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(form.logo_url)}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-neutral-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight truncate text-sm">
                {form.trading_name || 'Your company'}
              </span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> CIPC verified
                </span>
              )}
              {bankVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
                  <Wallet className="w-3 h-3" /> Bank verified
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 truncate">
              {[form.industry, form.city, form.country].filter(Boolean).join(' · ') ||
                'Complete your profile below'}
            </div>
          </div>
          <div className="shrink-0 text-right w-20">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
              Complete
            </div>
            <div className="text-lg font-black tracking-tighter tabular-nums leading-none">
              {completeness?.pct ?? 0}%
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mt-2.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6]"
            style={{ width: `${completeness?.pct ?? 0}%` }}
          />
        </div>
        <div className="mt-3">
          <SearchVisibilityCard
            profile={
              {
                ...form,
                id: companyId,
                is_discoverable:
                  form.is_discoverable === false ? false : true,
              } as Record<string, unknown>
            }
            completeness={completeness}
            isRegistered
            toggling={saving}
            onToggleDiscoverable={async (next) => {
              setForm((prev) => ({ ...prev, is_discoverable: next }));
              try {
                await persistPartial({ is_discoverable: next });
                toast.success(
                  next
                    ? 'Discoverable on — you can appear in search'
                    : 'Hidden from Discover & directory'
                );
              } catch (e: unknown) {
                setForm((prev) => ({ ...prev, is_discoverable: !next }));
                toast.error(
                  e instanceof Error ? e.message : 'Could not update visibility'
                );
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* ── Identity + CIPC (grouped) ── */}
        <Panel
          id="identity"
          title="Identity & CIPC verification"
          action={
            isVerified ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Unverified
              </span>
            )
          }
        >
          <div className="p-4 grid lg:grid-cols-5 gap-4 lg:gap-5">
            {/* Left: identity fields */}
            <div className="lg:col-span-3 space-y-2.5 min-w-0">
              <CardSubhead>Company details</CardSubhead>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Field label="Trading name *">
                  <input
                    className={inputCls}
                    value={form.trading_name || ''}
                    onChange={(e) => set('trading_name', e.target.value)}
                  />
                </Field>
                <Field label="Legal name">
                  <input
                    className={inputCls}
                    value={form.legal_name || ''}
                    onChange={(e) => set('legal_name', e.target.value)}
                  />
                </Field>
                <Field label="Business type" className="sm:col-span-2">
                  <select
                    className={inputCls}
                    value={form.business_type || form.category || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      set('business_type', v);
                      set('category', v);
                    }}
                  >
                    <option value="">Select business type…</option>
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
                <Field label="Registration no. (CIPC)">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.registration_number || ''}
                    onChange={(e) => set('registration_number', e.target.value)}
                    placeholder="2020/123456/07"
                  />
                </Field>
                <Field label="VAT number">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.vat_number || ''}
                    onChange={(e) => set('vat_number', e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <FileUploadField
                  label="Registration document"
                  url={form.registration_certificate_url}
                  compact
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
                    void persistPartial({ registration_certificate_url: null }).catch(
                      () => undefined
                    );
                  }}
                />
                <FileUploadField
                  label="VAT certificate"
                  url={form.vat_certificate_url}
                  compact
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
              </div>
              <div className="grid sm:grid-cols-3 gap-2.5">
                <Field label="About" className="sm:col-span-2">
                  <textarea
                    className={`${inputCls} min-h-[72px] resize-y`}
                    value={String(
                      form.description || form.short_description || form.about || ''
                    )}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this company do?"
                  />
                </Field>
                <FileUploadField
                  label="Logo"
                  url={form.logo_url}
                  accept="image/*"
                  compact
                  previewImage
                  uploading={uploading === 'logo'}
                  onFile={(f) =>
                    void handleUpload(f, 'logo', (url) => set('logo_url', url), 'logo_url')
                  }
                  onClear={() => {
                    set('logo_url', null);
                    void persistPartial({ logo_url: null }).catch(() => undefined);
                  }}
                />
              </div>
            </div>

            {/* Right: CIPC verify */}
            <div className="lg:col-span-2 min-w-0">
              <div className="h-full rounded-xl border border-[#00b4d8]/20 bg-gradient-to-b from-[#00b4d8]/[0.06] to-white p-3.5 space-y-2.5">
                <CardSubhead
                  action={
                    <span className="text-[10px] font-bold text-[#0077b6] tabular-nums">
                      R{VERIFY_AMOUNT_ZAR}
                    </span>
                  }
                >
                  CIPC check
                </CardSubhead>
                <p className="text-[11px] text-neutral-600 leading-snug">
                  Live VerifyNow CIPC lookup using the registration / VAT number on the left.
                  Pay via Paystack — check runs on this page.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-neutral-200/80 bg-white px-2.5 py-2 min-w-0">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                      Reg. no.
                    </div>
                    <div className="text-xs font-mono text-slate-800 truncate mt-0.5">
                      {registrationForVerify || (
                        <span className="font-sans text-amber-700">Enter left</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-200/80 bg-white px-2.5 py-2 min-w-0">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                      Status
                    </div>
                    <div className="mt-0.5 text-xs font-bold">
                      {isVerified ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      ) : verificationStatus === 'mismatch' ? (
                        <span className="text-amber-700">Mismatch</span>
                      ) : verificationStatus === 'failed' ? (
                        <span className="text-red-700">Failed</span>
                      ) : verificationStatus === 'pending' ? (
                        <span className="text-sky-700">Pending…</span>
                      ) : (
                        <span className="text-neutral-500 font-semibold">Unverified</span>
                      )}
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                    checked={verifyConsent}
                    onChange={(e) => setVerifyConsent(e.target.checked)}
                  />
                  <span className="text-[11px] text-neutral-600 leading-snug">
                    Authorise CIPC check via VerifyNow (KYB / FICA-style). No redirect.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={
                    verifying ||
                    paying ||
                    !verifyConsent ||
                    (!registrationForVerify && !vatForVerify)
                  }
                  onClick={startVerifyPayment}
                  className="btn-primary w-full !py-2 !px-3 text-xs inline-flex items-center justify-center gap-1.5"
                >
                  {paying || verifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isVerified
                        ? `Pay R${VERIFY_AMOUNT_ZAR} & re-verify`
                        : `Pay R${VERIFY_AMOUNT_ZAR} & verify CIPC`}
                    </>
                  )}
                </button>

                {/* Recovery when payment already taken but badge missing */}
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    disabled={
                      verifying ||
                      paying ||
                      !verifyConsent ||
                      (!registrationForVerify && !vatForVerify)
                    }
                    onClick={rerunCipcReusePayment}
                    className="btn-secondary w-full !py-2 !px-3 text-[11px] font-bold inline-flex items-center justify-center gap-1"
                    title="Uses the Paystack reference already stored on this company — no second R69 charge"
                  >
                    Re-run CIPC (reuse payment)
                  </button>
                  {!isVerified && metaVerification ? (
                    <button
                      type="button"
                      disabled={verifying || paying}
                      onClick={() => void recoverVerifiedFromMetadata()}
                      className="w-full rounded-xl border border-amber-200 bg-amber-50 !py-2 !px-3 text-[11px] font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                      title="If CIPC already returned a match but the badge never saved"
                    >
                      Apply verified from last CIPC result
                    </button>
                  ) : null}
                </div>
                <p className="text-[10px] text-neutral-500 leading-snug">
                  Payment alone does not set the badge — CIPC must pass. Use{' '}
                  <strong>Re-run</strong> after fixing name/reg if you already paid.
                </p>

                {displayVerification &&
                  (displayVerification.companyName ||
                    displayVerification.registrationNumber) && (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <Building2 className="w-3.5 h-3.5" />
                        CIPC result
                        {(verifyResult?.status === 'verified' || isVerified) && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                        {displayVerification.companyName ? (
                          <>
                            <dt className="text-neutral-500">Name</dt>
                            <dd className="font-semibold text-slate-800 truncate">
                              {String(displayVerification.companyName)}
                            </dd>
                          </>
                        ) : null}
                        {displayVerification.registrationNumber ? (
                          <>
                            <dt className="text-neutral-500">Reg.</dt>
                            <dd className="font-mono text-slate-800 truncate">
                              {String(displayVerification.registrationNumber)}
                            </dd>
                          </>
                        ) : null}
                        {displayVerification.companyStatus ? (
                          <>
                            <dt className="text-neutral-500">Status</dt>
                            <dd className="font-semibold text-slate-800">
                              {String(displayVerification.companyStatus)}
                            </dd>
                          </>
                        ) : null}
                        {displayVerification.nameMatch &&
                        displayVerification.nameMatch !== 'unknown' ? (
                          <>
                            <dt className="text-neutral-500">Match</dt>
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
                    </div>
                  )}
                {form.verification_payment_ref ? (
                  <p className="text-[10px] text-neutral-400 font-mono truncate">
                    Pay ref: {String(form.verification_payment_ref)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Contacts + Location ── */}
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <Panel id="contacts" title="Contacts">
            <div className="p-4 space-y-2.5">
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Field label="Primary contact">
                  <input
                    className={inputCls}
                    value={form.contact_name || ''}
                    onChange={(e) => set('contact_name', e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email || ''}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className={inputCls}
                    value={form.contact_phone || form.contact_number || form.phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label="Website">
                  <input
                    className={inputCls}
                    value={form.website || ''}
                    onChange={(e) => set('website', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Wallet (on-chain)">
                <div className="relative">
                  <input
                    className={`${inputCls} font-mono pr-9`}
                    value={form.wallet_address || loginWallet || ''}
                    onChange={(e) => set('wallet_address', e.target.value)}
                    placeholder="0x…"
                  />
                  <Wallet className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
                {loginWallet ? (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Login:{' '}
                    <span className="font-mono">
                      {loginWallet.slice(0, 6)}…{loginWallet.slice(-4)}
                    </span>
                    {(!form.wallet_address ||
                      form.wallet_address.toLowerCase() !== loginWallet.toLowerCase()) && (
                      <button
                        type="button"
                        className="ml-1.5 text-[#00b4d8] font-semibold hover:underline"
                        onClick={() => set('wallet_address', loginWallet)}
                      >
                        Use login wallet
                      </button>
                    )}
                  </p>
                ) : null}
              </Field>
            </div>
          </Panel>

          <Panel id="location" title="Location">
            <div className="p-4 space-y-2.5">
              <GeoSelectFields
                value={geo}
                onChange={onGeoChange}
                compact
                continentRequired
                countryRequired
              />
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Street" className="col-span-2">
                  <input
                    className={inputCls}
                    value={form.street || form.address || ''}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </Field>
                <Field label="Postal">
                  <input
                    className={inputCls}
                    value={form.postal_code || ''}
                    onChange={(e) => set('postal_code', e.target.value)}
                  />
                </Field>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  <MapPin className="w-3 h-3 text-[#00b4d8]" /> Map pin
                </div>
                <div className="relative z-0 h-40 w-full rounded-xl overflow-hidden border border-neutral-200 bg-slate-100 isolate">
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
                    height="160px"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  <Field label="Latitude">
                    <input
                      className={`${inputCls} font-mono`}
                      value={form.latitude ?? form.lat ?? ''}
                      onChange={(e) => {
                        set('latitude', e.target.value);
                        set('lat', e.target.value);
                      }}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      className={`${inputCls} font-mono`}
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
        </div>

        {/* ── Industry + Certifications ── */}
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <Panel id="industry" title="Industry">
            <div className="p-4 space-y-3">
              <div>
                <SectionLabel>Primary industries</SectionLabel>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMPANY_INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => toggleIndustry(ind)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
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
                <SectionLabel>Sub-industries</SectionLabel>
                <div className="flex flex-wrap gap-1 mt-1.5 max-h-32 overflow-y-auto">
                  {subIndustryOptions.length === 0 ? (
                    <p className="text-[11px] text-neutral-400">Select an industry first.</p>
                  ) : (
                    subIndustryOptions.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleSubIndustry(sub)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                          selectedSubIndustries.includes(sub)
                            ? 'border-[#0077b6] bg-[#0077b6]/10 text-[#0077b6]'
                            : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                        }`}
                      >
                        {sub}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Certifications & B-BBEE"
            action={
              <button
                type="button"
                onClick={addCustomCert}
                className="text-[11px] font-semibold text-[#00b4d8] inline-flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            }
          >
            <div className="p-4 space-y-2.5 max-md:max-h-64 max-md:overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="B-BBEE level">
                  <select
                    className={inputCls}
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
                <FileUploadField
                  label="BEE certificate"
                  url={form.bee_certificate_url}
                  compact
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
              <div className="flex flex-wrap gap-1">
                {CERTS_PRESET.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => togglePresetCert(c)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                      certEntries.some((x) => x.name === c)
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {certEntries.length === 0 && (
                  <p className="text-[11px] text-neutral-400">
                    No certs yet — use presets or Add.
                  </p>
                )}
                {certEntries.map((c, idx) => (
                  <div
                    key={`${c.name}-${idx}`}
                    className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-2 space-y-1.5"
                  >
                    <div className="flex gap-1.5">
                      <input
                        className="input flex-1 !py-1.5 !px-2 !text-xs"
                        placeholder="Certificate name"
                        value={c.name}
                        onChange={(e) => updateCert(idx, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeCert(idx)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="date"
                        className="input w-full !py-1.5 !px-2 !text-xs"
                        value={c.awarded_date || ''}
                        onChange={(e) => updateCert(idx, { awarded_date: e.target.value })}
                        title="Awarded"
                      />
                      <input
                        type="date"
                        className="input w-full !py-1.5 !px-2 !text-xs"
                        value={c.expiry_date || ''}
                        onChange={(e) => updateCert(idx, { expiry_date: e.target.value })}
                        title="Expiry"
                      />
                    </div>
                    <FileUploadField
                      label="File"
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
                            const names = cleanCerts
                              .map((entry) => entry.name)
                              .filter(Boolean);
                            void persistPartial({
                              uploaded_certificates: cleanCerts,
                              certifications: names,
                              iso_certifications: names,
                            }).catch(() => undefined);
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
        </div>

        {/* ── Banking + Licenses ── */}
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <Panel
            id="banking"
            title="Banking"
            action={
              bankVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              ) : bankFailed ? (
                <span className="text-[10px] font-bold uppercase text-red-600">Failed</span>
              ) : null
            }
          >
            <div className="p-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Bank name">
                  <input
                    className={inputCls}
                    value={form.bank_name || ''}
                    onChange={(e) => set('bank_name', e.target.value)}
                    placeholder="FNB, Capitec…"
                  />
                </Field>
                <Field label="Account type">
                  <select
                    className={inputCls}
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
                <Field label="Account name" className="col-span-2">
                  <input
                    className={inputCls}
                    value={form.account_name || ''}
                    onChange={(e) => set('account_name', e.target.value)}
                  />
                </Field>
                <Field label="Account number">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.account_number || ''}
                    onChange={(e) => set('account_number', e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Branch code">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.branch_code || ''}
                    onChange={(e) =>
                      set('branch_code', e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="6 digits"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </Field>
                <Field label="IBAN">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.iban || ''}
                    onChange={(e) => set('iban', e.target.value)}
                  />
                </Field>
                <Field label="SWIFT">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.swift || ''}
                    onChange={(e) => set('swift', e.target.value)}
                  />
                </Field>
              </div>
              <FileUploadField
                label="Bank confirmation letter"
                url={form.bank_confirmation_url}
                compact
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

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#00b4d8]" />
                    Bank AVS · R{BANK_VERIFY_AMOUNT_ZAR}
                  </div>
                  {bankVerified && (
                    <span className="text-[10px] font-bold text-emerald-700">Verified</span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 leading-snug">
                  VerifyNow ownership check. Needs account + branch + reg. no. or director ID.
                </p>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                    checked={bankVerifyConsent}
                    onChange={(e) => setBankVerifyConsent(e.target.checked)}
                  />
                  <span className="text-[11px] text-neutral-600 leading-snug">
                    Authorise bank ownership check via VerifyNow after R
                    {BANK_VERIFY_AMOUNT_ZAR} payment.
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={bankPaying || bankVerifying}
                    onClick={startBankVerifyPayment}
                    className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                  >
                    {bankPaying || bankVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {bankVerifying ? 'VerifyNow…' : 'Paystack…'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {bankVerified
                          ? `Pay R${BANK_VERIFY_AMOUNT_ZAR} & re-verify`
                          : `Pay R${BANK_VERIFY_AMOUNT_ZAR} & verify`}
                      </>
                    )}
                  </button>
                  {(bankPaying || bankVerifying) && (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-neutral-500 underline"
                      onClick={() => {
                        setBankPaying(false);
                        setBankVerifying(false);
                        bankVerifyInFlightRef.current = false;
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
                {Boolean(
                  bankVerifyResult?.verification &&
                    (bankVerifyResult.verification.summary ||
                      bankVerifyResult.verification.accountFound ||
                      bankVerifyResult.verification.statusText)
                ) ? (
                  <div
                    className={`rounded-lg border p-2 text-[11px] space-y-1 ${
                      bankVerifyResult?.status === 'verified'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    {bankVerifyResult?.message ? (
                      <p className="font-semibold text-slate-800">{bankVerifyResult.message}</p>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {(
                        [
                          {
                            label: 'Found',
                            value: String(
                              bankVerifyResult?.verification?.accountFound ?? ''
                            ),
                          },
                          {
                            label: 'Open',
                            value: String(
                              bankVerifyResult?.verification?.accountOpen ?? ''
                            ),
                          },
                          {
                            label: 'Identity',
                            value: String(
                              bankVerifyResult?.verification?.identityMatch ?? ''
                            ),
                          },
                          {
                            label: 'Credits',
                            value: String(
                              bankVerifyResult?.verification?.acceptsCredits ?? ''
                            ),
                          },
                        ] satisfies Array<{ label: string; value: string }>
                      )
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

                <label className="flex items-start gap-2 cursor-pointer select-none pt-1 border-t border-neutral-100">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                    checked={Boolean(
                      form.metadata &&
                        typeof form.metadata === 'object' &&
                        (form.metadata as { show_bank_verified_public?: boolean })
                          .show_bank_verified_public === true
                    )}
                    onChange={(e) => {
                      const prevMeta =
                        form.metadata && typeof form.metadata === 'object'
                          ? { ...(form.metadata as Record<string, unknown>) }
                          : {};
                      const next = {
                        ...prevMeta,
                        show_bank_verified_public: e.target.checked,
                      };
                      setForm((p) => ({ ...p, metadata: next }));
                      void persistPartial({ metadata: next }).catch(() => undefined);
                    }}
                  />
                  <span className="text-[11px] text-neutral-600 leading-snug">
                    <strong className="text-slate-800">Show bank verified badge</strong> on
                    public directory (/c/…). Off by default for privacy.
                  </span>
                </label>
              </div>
            </div>
          </Panel>

          <Panel
            id="licenses"
            title="Licenses & director"
            action={
              <button
                type="button"
                onClick={addExportLicense}
                className="text-[11px] font-semibold text-[#00b4d8] inline-flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Export
              </button>
            }
          >
            <div className="p-4 space-y-2.5 max-md:max-h-72 max-md:overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Field label="Director SA ID">
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.director_id_number || ''}
                    onChange={(e) => set('director_id_number', e.target.value)}
                    placeholder="For bank AVS if no CIPC reg"
                  />
                </Field>
                <Field label="Import license no.">
                  <input
                    className={inputCls}
                    value={form.import_license_number || ''}
                    onChange={(e) => set('import_license_number', e.target.value)}
                  />
                </Field>
              </div>
              <FileUploadField
                label="Import license document"
                url={form.import_license_url}
                compact
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
              <CardSubhead>Export licenses (per country)</CardSubhead>
              {exportLicenses.length === 0 && (
                <p className="text-[11px] text-neutral-400 -mt-1">None yet.</p>
              )}
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {exportLicenses.map((lic, idx) => (
                  <div
                    key={`exp-${idx}`}
                    className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-2 space-y-1.5"
                  >
                    <div className="flex gap-1.5">
                      <input
                        className="input flex-1 !py-1.5 !px-2 !text-xs"
                        placeholder="Country"
                        value={lic.country}
                        onChange={(e) => updateExport(idx, { country: e.target.value })}
                      />
                      <input
                        className="input flex-1 !py-1.5 !px-2 !text-xs"
                        placeholder="License no."
                        value={lic.license_number || ''}
                        onChange={(e) =>
                          updateExport(idx, { license_number: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeExport(idx)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <FileUploadField
                      label="File"
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
      </div>

      <div className="mt-4 flex justify-end sticky bottom-3 z-10">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary !py-2.5 !px-6 text-sm shadow-lg shadow-[#00b4d8]/20 inline-flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" /> Save profile
            </>
          )}
        </button>
      </div>
    </BusinessPage>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/** Compact section heading inside a card body */
function CardSubhead({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {children}
      </h4>
      {action}
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
        className={`mt-0.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/40 ${
          compact ? 'p-2' : 'p-2.5'
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
