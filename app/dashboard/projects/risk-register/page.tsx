'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Risk = {
  id: number;
  title: string;
  likelihood: number;
  impact: number;
  score?: number;
  status?: string;
  mitigation?: string | null;
};

export default function RiskRegisterPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    likelihood: '3',
    impact: '3',
    mitigation: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const res = await fetch(`/api/projects/risks?${p}`);
      const json = await res.json();
      setRisks(json.risks || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!form.title.trim()) return;
    const res = await fetch('/api/projects/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        title: form.title,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        mitigation: form.mitigation || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('Risk added');
    setForm({ title: '', likelihood: '3', impact: '3', mitigation: '' });
    await load();
  };

  const close = async (id: number) => {
    await fetch('/api/projects/risks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status: 'closed' }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Risk"
        title="Register"
        titleAccent="live"
        description="Score = likelihood × impact (1–5 each). Mitigate high scores first."
      />

      <div className="bg-white border rounded-3xl p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input
          className="input !py-2 !text-sm lg:col-span-2"
          placeholder="Risk title *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <select
          className="input !py-2 !text-sm"
          value={form.likelihood}
          onChange={(e) => setForm({ ...form, likelihood: e.target.value })}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Likelihood {n}
            </option>
          ))}
        </select>
        <select
          className="input !py-2 !text-sm"
          value={form.impact}
          onChange={(e) => setForm({ ...form, impact: e.target.value })}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Impact {n}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void add()} className="btn-primary !py-2 text-sm">
          <Plus className="w-4 h-4" /> Add risk
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y">
          {risks.length === 0 ? (
            <li className="p-12 text-center text-sm text-neutral-500">No risks registered.</li>
          ) : (
            risks.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{r.title}</div>
                  {r.mitigation && (
                    <div className="text-xs text-neutral-500 mt-0.5">Mitigation: {r.mitigation}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      (r.score || 0) >= 15
                        ? 'bg-red-100 text-red-800'
                        : (r.score || 0) >= 8
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Score {r.score ?? r.likelihood * r.impact}
                  </span>
                  {r.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => void close(r.id)}
                      className="text-xs text-neutral-500 underline"
                    >
                      Close
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </RelationshipPage>
  );
}
