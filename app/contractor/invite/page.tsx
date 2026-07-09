'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  ArrowRight,
  MapPin,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CONTRACTOR_CONTRACT_TITLE,
  CONTRACTOR_CONTRACT_VERSION,
  getContractorContractHtml,
} from '@/lib/contracts/independent-contractor-agreement';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [invite, setInvite] = useState<{
    email: string;
    full_name?: string;
    company_name?: string;
    container_name?: string;
    contract_version?: string;
    expires_at?: string;
  } | null>(null);
  const [container, setContainer] = useState<{
    name?: string;
    container_code?: string;
    city?: string;
    country?: string;
    address?: string;
    photo_url?: string;
  } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = useCallback(async () => {
    if (!token) {
      setError('Missing invitation token');
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/containers/contractor-invite?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.valid) {
      setError(data.error || 'Invalid invitation');
      setValid(false);
      setAlreadyAccepted(!!data.alreadyAccepted);
    } else {
      setValid(true);
      setInvite(data.invite);
      setContainer(data.container);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void validate();
  }, [validate]);

  const accept = async () => {
    if (!agreed) {
      toast.error('Please accept the agreement to continue');
      return;
    }
    if (!authenticated || !user) {
      login();
      return;
    }

    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    setSubmitting(true);
    try {
      const res = await fetch('/api/containers/contractor-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          privyUserId,
          email,
          full_name: invite?.full_name,
          contractAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      setDone(true);
      toast.success('Welcome — contract accepted');
      setTimeout(() => router.replace('/contractor'), 1000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-[#00b4d8] mb-2">You&apos;re in</h1>
          <p className="text-neutral-600">
            Opening your operator portal for{' '}
            <strong>{invite?.container_name || 'your outlet'}</strong>…
          </p>
        </div>
      </div>
    );
  }

  if (!valid || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md bg-white border rounded-3xl p-10 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">
            {alreadyAccepted ? 'Already accepted' : 'Invitation unavailable'}
          </h1>
          <p className="text-neutral-600 mb-6">{error}</p>
          <Link href="/login?next=/contractor" className="btn-primary px-6 py-3 inline-block">
            Sign in to operator portal
          </Link>
        </div>
      </div>
    );
  }

  const contractHtml = getContractorContractHtml({
    contractorName: invite?.full_name || invite?.email || 'Contractor',
    companyName: invite?.company_name || 'Company',
    containerName: invite?.container_name || container?.name || 'Container',
    containerCode: container?.container_code,
  });

  const signedEmail = authenticated ? extractEmailFromPrivyUser(user) : null;
  const emailMismatch =
    authenticated &&
    signedEmail &&
    invite?.email &&
    signedEmail !== String(invite.email).toLowerCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/sa-logo.png" alt="SA" width={40} height={40} className="rounded-xl" />
          <div>
            <div className="font-black text-lg text-slate-900">Operator invitation</div>
            <div className="text-xs text-neutral-500">SupplierAdvisor® Independent Contractor</div>
          </div>
        </div>

        {/* Steps */}
        <ol className="flex flex-wrap gap-2 mb-6 text-xs font-semibold">
          {['1. Review outlet', '2. Read contract', '3. Sign in & accept'].map((step, i) => (
            <li
              key={step}
              className={`px-3 py-1.5 rounded-full ${
                i === 0
                  ? 'bg-[#00b4d8] text-white'
                  : 'bg-white border text-neutral-600'
              }`}
            >
              {step}
            </li>
          ))}
        </ol>

        <div className="bg-white border rounded-3xl overflow-hidden mb-6">
          {container?.photo_url && (
            <div className="relative w-full h-44 bg-neutral-100">
              <Image
                src={container.photo_url}
                alt={invite?.container_name || 'Outlet'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure invitation · expires in 14 days
            </div>
            <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-2">
              {invite?.container_name || 'Your retail outlet'}
            </h1>
            <p className="text-neutral-600 mb-4">
              <strong>{invite?.company_name}</strong> invites you to operate this container as an
              independent contractor. After you accept, you will only see <em>this outlet</em> —
              inventory, orders, sales, and stock counts.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
              {(container?.city || container?.country || container?.address) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#00b4d8]" />
                  {[container?.address, container?.city, container?.country]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
              {container?.container_code && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <Package className="w-4 h-4 text-[#00b4d8]" />
                  {container.container_code}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm bg-sky-50 text-sky-900 rounded-2xl px-4 py-3">
              Sign in with <strong>{invite?.email}</strong> — the same address this invitation was
              sent to.
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-3xl p-6 sm:p-8 mb-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-900">
            <FileText className="w-5 h-5 text-[#00b4d8]" />
            {CONTRACTOR_CONTRACT_TITLE}
          </h2>
          <div
            className="max-h-96 overflow-y-auto rounded-2xl border border-neutral-100 bg-neutral-50 p-5 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: contractHtml }}
          />
          <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the Independent Contractor Agreement (version{' '}
              <strong>{CONTRACTOR_CONTRACT_VERSION}</strong>) for this outlet. I understand I am not
              an employee and will only access containers allocated to me.
            </span>
          </label>
        </div>

        <div className="bg-white border rounded-3xl p-6 space-y-4">
          {authenticated ? (
            <div>
              <p className="text-sm text-neutral-600">
                Signed in as <strong>{signedEmail || user?.id}</strong>
              </p>
              {emailMismatch && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  Email mismatch: please sign out and sign in with <strong>{invite?.email}</strong>.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              Continue with secure sign-in using the invited email. You&apos;ll receive a one-time
              code (or use Google / Apple).
            </p>
          )}
          <button
            type="button"
            disabled={!agreed || submitting || !!emailMismatch}
            onClick={() => void accept()}
            className="btn-primary w-full !py-4 text-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : authenticated ? (
              <>
                Accept agreement &amp; open portal <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              <>
                Sign in &amp; accept agreement <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          <p className="text-center text-xs text-neutral-400">
            By accepting you create a binding independent contractor relationship under version{' '}
            {CONTRACTOR_CONTRACT_VERSION}.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ContractorInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
