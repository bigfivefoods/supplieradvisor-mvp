'use client';

import { useRef, useState, type ReactNode } from 'react';
import {
  Award,
  ExternalLink,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  newQualificationId,
  type PersonQualification,
} from '@/lib/services/person-qualifications';

export function PersonQualificationsEditor({
  qualifications,
  onChange,
  uploadFile,
  disabled,
  toneClass = 'border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/50',
  title = 'Qualifications & certificates',
  description = 'Degrees, HPCSA / BHF numbers, short courses — upload the certificate next to each one.',
}: {
  qualifications: PersonQualification[];
  onChange: (next: PersonQualification[]) => void | Promise<void>;
  uploadFile: (file: File) => Promise<{ url: string; fileName: string }>;
  disabled?: boolean;
  toneClass?: string;
  title?: string;
  description?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    issuer: '',
    year: '',
    registration_number: '',
  });

  const list = qualifications || [];

  const add = async () => {
    const title = draft.title.trim();
    if (!title) {
      toast.error('Add the qualification name first');
      return;
    }
    const next: PersonQualification = {
      id: newQualificationId(),
      title,
      issuer: draft.issuer.trim() || undefined,
      year: draft.year.trim() || null,
      registration_number: draft.registration_number.trim() || undefined,
      public: true,
      certificates: [],
      created_at: new Date().toISOString(),
    };
    await onChange([next, ...list]);
    setDraft({ title: '', issuer: '', year: '', registration_number: '' });
    toast.success('Qualification added');
  };

  const patch = async (id: string, part: Partial<PersonQualification>) => {
    await onChange(list.map((q) => (q.id === id ? { ...q, ...part } : q)));
  };

  const remove = async (id: string) => {
    await onChange(list.filter((q) => q.id !== id));
    toast.success('Qualification removed');
  };

  const upload = async (qualId: string, file: File) => {
    setUploadingFor(qualId);
    try {
      const stored = await uploadFile(file);
      const cert = {
        id: newQualificationId('qcert'),
        file_name: stored.fileName,
        url: stored.url,
        uploaded_at: new Date().toISOString(),
      };
      await onChange(
        list.map((q) =>
          q.id === qualId
            ? { ...q, certificates: [...(q.certificates || []), cert] }
            : q
        )
      );
      toast.success('Certificate uploaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingFor(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeCert = async (qualId: string, certId: string) => {
    await onChange(
      list.map((q) =>
        q.id === qualId
          ? {
              ...q,
              certificates: (q.certificates || []).filter((c) => c.id !== certId),
            }
          : q
      )
    );
  };

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${toneClass}`}>
      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-slate-100">
          <GraduationCap className="h-4 w-4 shrink-0" />
          {title}
        </h4>
        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300/80">
          {description}
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No qualifications on this bio yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 dark:border-slate-600 dark:bg-slate-950/60"
            >
              <div className="flex flex-wrap items-start gap-2">
                <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100">
                    {q.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {[q.issuer, q.year, q.registration_number]
                      .filter(Boolean)
                      .join(' · ') || 'Add issuer / year / registration'}
                  </p>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={q.public !== false}
                      disabled={disabled}
                      onChange={(e) =>
                        void patch(q.id, { public: e.target.checked })
                      }
                    />
                    Show on public bio
                  </label>
                  {(q.certificates || []).map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-1.5 text-[11px]"
                    >
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-sky-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {c.file_name}
                      </a>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void removeCert(q.id, c.id)}
                        className="text-[10px] font-bold text-rose-600"
                      >
                        Remove file
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={disabled || uploadingFor === q.id}
                    onClick={() => {
                      fileRef.current?.setAttribute('data-qual', q.id);
                      fileRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-700"
                  >
                    {uploadingFor === q.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Certificate
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void remove(q.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Qualification (e.g. BSc Physiotherapy)"
          value={draft.title}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Issuer (university / HPCSA / SETA)"
          value={draft.issuer}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, issuer: e.target.value }))}
        />
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Year"
          value={draft.year}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
        />
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Registration / certificate no."
          value={draft.registration_number}
          disabled={disabled}
          onChange={(e) =>
            setDraft((d) => ({ ...d, registration_number: e.target.value }))
          }
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void add()}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-violet-600"
      >
        <Plus className="h-3.5 w-3.5" />
        Add qualification
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,application/pdf,.doc,.docx,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const qualId = e.currentTarget.getAttribute('data-qual');
          e.currentTarget.removeAttribute('data-qual');
          if (f && qualId) void upload(qualId, f);
        }}
      />
    </div>
  );
}

export function PersonQualificationsList({
  qualifications,
  empty = null,
}: {
  qualifications?: PersonQualification[] | Array<{
    title: string;
    issuer?: string;
    year?: string | null;
    certificates?: Array<{ file_name: string; url: string }>;
  }>;
  empty?: ReactNode;
}) {
  const rows = qualifications || [];
  if (!rows.length) return empty;
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map((q, i) => (
        <li key={`${q.title}-${i}`} className="text-[12px] text-slate-600">
          <span className="font-semibold text-slate-800">{q.title}</span>
          {q.issuer || q.year ? (
            <span className="text-slate-500">
              {' '}
              · {[q.issuer, q.year].filter(Boolean).join(' · ')}
            </span>
          ) : null}
          {(q.certificates || []).map((c) => (
            <a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1.5 text-[11px] font-bold text-sky-800"
            >
              Certificate
            </a>
          ))}
        </li>
      ))}
    </ul>
  );
}
