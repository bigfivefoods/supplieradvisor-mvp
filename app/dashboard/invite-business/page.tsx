'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Copy, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteBusinessPage() {
  const [form, setForm] = useState({
    trading_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inviteLink: string; warning?: string } | null>(null);

  const invitedBy =
    (typeof window !== 'undefined' && localStorage.getItem('selectedCompanyName')) ||
    'A SupplierAdvisor partner';
  const inviterProfileId =
    typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null;

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/invite-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          invitedBy,
          inviterProfileId,
          relationship_type: 'business',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send invitation');
        setLoading(false);
        return;
      }

      setResult({ inviteLink: data.inviteLink, warning: data.warning });
      toast.success(data.warning ? 'Invite created (email issue)' : 'Invitation emailed successfully');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/network" className="text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-black text-4xl tracking-tight text-[#00b4d8]">Invite a Business</h1>
          <p className="text-neutral-600 mt-1">
            Start onboarding for a partner, supplier, or customer. They get a secure claim link by email.
          </p>
        </div>
      </div>

      {!result ? (
        <form onSubmit={submit} className="space-y-6 bg-white border border-neutral-200 rounded-3xl p-8">
          <div>
            <label className="text-sm font-medium">Business / company name *</label>
            <input
              className="input w-full mt-1"
              value={form.trading_name}
              onChange={(e) => update('trading_name', e.target.value)}
              required
              placeholder="Acme Fresh Produce"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contact name</label>
              <input
                className="input w-full mt-1"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                placeholder="Jane Dlamini"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contact email *</label>
              <input
                type="email"
                className="input w-full mt-1"
                value={form.contact_email}
                onChange={(e) => update('contact_email', e.target.value)}
                required
                placeholder="jane@acme.co.za"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                className="input w-full mt-1"
                value={form.contact_phone}
                onChange={(e) => update('contact_phone', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <input
                className="input w-full mt-1"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Fresh produce"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Website</label>
            <input
              className="input w-full mt-1"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://"
            />
          </div>

          <div className="p-4 rounded-2xl bg-[#00b4d8]/5 border border-[#00b4d8]/20 text-sm text-neutral-700 flex gap-3">
            <Mail className="w-5 h-5 text-[#00b4d8] flex-shrink-0" />
            <p>
              They&apos;ll receive a branded email with a one-time link. After secure Privy sign-in (email code /
              Google / Apple), they claim the company and become the owner.
            </p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg disabled:opacity-60">
            {loading ? 'Sending…' : (
              <span className="inline-flex items-center gap-2">
                Send invitation <Send className="w-5 h-5" />
              </span>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <h2 className="font-semibold text-2xl text-slate-900">Invitation ready</h2>
          </div>
          {result.warning && (
            <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm mb-4">
              {result.warning}
            </p>
          )}
          <p className="text-neutral-600 mb-4">Share this secure link if they didn&apos;t get the email:</p>
          <div className="bg-neutral-100 p-4 rounded-2xl break-all text-sm mb-6 font-mono">
            {result.inviteLink}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(result.inviteLink);
              toast.success('Link copied');
            }}
            className="btn-primary w-full py-3 mb-3 inline-flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy invite link
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm({
                trading_name: '',
                contact_name: '',
                contact_email: '',
                contact_phone: '',
                website: '',
                category: '',
              });
            }}
            className="btn-secondary w-full py-3"
          >
            Invite another business
          </button>
        </div>
      )}
    </div>
  );
}
