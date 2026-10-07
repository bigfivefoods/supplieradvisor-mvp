'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Mail } from 'lucide-react';

export default function FooterFoundingForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/public/founding-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to join right now. Please try again.');
      }
      setMessage(data.message || 'Thanks — you are on the founding list.');
      setEmail('');
      setConsent(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to join right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      <div className="relative">
        <label htmlFor="footer-founding-email" className="sr-only">
          Email address
        </label>
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <input
          id="footer-founding-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-full border border-black/10 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-[#6b7280]"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0077b6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#005f92] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
        Join
      </button>
      <label className="flex items-start gap-2 text-xs text-[#525252]">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-black/20"
        />
        <span>
          I agree to the{' '}
          <Link
            href="/privacy"
            prefetch={false}
            className="inline-flex min-h-6 items-center underline underline-offset-2 hover:text-[#0077b6]"
          >
            Privacy Policy
          </Link>
        </span>
      </label>
      {message ? (
        <p role="status" className="text-sm text-[#6b7280]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
