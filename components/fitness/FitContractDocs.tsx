'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import {
  FIT_CONTRACT_KINDS,
  newId,
  type FitContractDoc,
} from '@/lib/fitness/fitgraph';
import { fc } from '@/components/fitness/FitForm';

function kindLabel(k?: string) {
  return String(k || 'other').replace(/_/g, ' ');
}

/**
 * Owner UI: list + upload PDF contracts for gym profile or coach bio.
 */
export function FitContractDocsPanel({
  companyId,
  contracts,
  onChange,
  title = 'PDF contracts',
  description = 'Upload membership agreements, waivers, or coach contracts (PDF preferred).',
  defaultKind = 'other',
  disabled,
  toneClass = 'border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/50',
}: {
  companyId: number;
  contracts: FitContractDoc[];
  onChange: (next: FitContractDoc[]) => void | Promise<void>;
  title?: string;
  description?: string;
  defaultKind?: string;
  disabled?: boolean;
  toneClass?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [kindDraft, setKindDraft] = useState(defaultKind);

  const upload = async (file: File) => {
    const lower = file.name.toLowerCase();
    const okType =
      file.type === 'application/pdf' ||
      lower.endsWith('.pdf') ||
      file.type.startsWith('image/') ||
      lower.endsWith('.doc') ||
      lower.endsWith('.docx');
    if (!okType) {
      toast.error('Please upload a PDF (preferred), Word doc, or image');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: 'fitgraph_contract',
        profileField: null,
      });
      if (!result.url) {
        toast.error(result.error || 'Upload failed');
        return;
      }
      const doc: FitContractDoc = {
        id: newId('ctr'),
        title:
          titleDraft.trim() ||
          file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') ||
          'Contract',
        file_name: result.fileName || file.name,
        url: result.url,
        uploaded_at: new Date().toISOString(),
        kind: kindDraft || defaultKind,
      };
      await onChange([...(contracts || []), doc]);
      setTitleDraft('');
      toast.success('Contract uploaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    await onChange((contracts || []).filter((c) => c.id !== id));
    toast.success('Contract removed');
  };

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${toneClass}`}>
      <div>
        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <FileText className="w-4 h-4 shrink-0" />
          {title}
        </h4>
        <p className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-0.5">
          {description}
        </p>
      </div>

      {(contracts || []).length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No contracts uploaded yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {contracts.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 text-[11px] dark:border-slate-600 dark:bg-slate-950/60"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {c.title}
                </div>
                <div className="text-slate-500 dark:text-slate-400 truncate">
                  {kindLabel(c.kind)} · {c.file_name}
                </div>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </a>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => void remove(c.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <input
          className={fc()}
          placeholder="Document title (optional)"
          value={titleDraft}
          disabled={disabled || uploading}
          onChange={(e) => setTitleDraft(e.target.value)}
        />
        <select
          className={fc()}
          value={kindDraft}
          disabled={disabled || uploading}
          onChange={(e) => setKindDraft(e.target.value)}
        >
          {FIT_CONTRACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {uploading ? 'Uploading…' : 'Upload PDF contract'}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf,.doc,.docx,image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
    </div>
  );
}
