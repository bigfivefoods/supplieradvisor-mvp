'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  CheckCircle2,
  RotateCcw,
  X,
  Landmark,
  Upload,
  Tags,
  Ban,
  Link2,
  Download,
  Layers,
  Sparkles,
  RefreshCw,
  Unplug,
  Wifi,
  Wand2,
  ListFilter,
  Trash2,
  Undo2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  statusClass,
  type BankAccount,
  type BankTransaction,
  type CoaAccount,
  type AccountingInvoice,
} from '@/lib/accounting/types';
import { BANK_CSV_FORMATS, UNIVERSAL_CSV_TEMPLATE } from '@/lib/accounting/csv';
import {
  groupTransactionsForMassAlloc,
  type MassAllocGroup,
} from '@/lib/accounting/mass-allocate';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';

type Pulse = {
  unallocated: number;
  allocated: number;
  matched_invoice: number;
  excluded: number;
  unallocatedIn: number;
  unallocatedOut: number;
};

type BankConnection = {
  id: number;
  status: string;
  provider?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_mask?: string | null;
  bank_account_id?: number | null;
  last_sync_at?: string | null;
  last_error?: string | null;
};

type BankingProviderInfo = {
  mode?: string;
  configured?: boolean;
  name?: string;
  docs?: string;
};

export default function BankReconciliationPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [allocFilter, setAllocFilter] = useState('unallocated');

  const [showAccount, setShowAccount] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMassAlloc, setShowMassAlloc] = useState(false);
  const [showAllocate, setShowAllocate] = useState<BankTransaction | null>(null);
  const [showMatch, setShowMatch] = useState<BankTransaction | null>(null);
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [saving, setSaving] = useState(false);
  /** All unallocated rows for mass-allocate (not limited by table filter). */
  const [massTxns, setMassTxns] = useState<BankTransaction[]>([]);
  const [massLoading, setMassLoading] = useState(false);
  const [massSearch, setMassSearch] = useState('');
  const [massDirection, setMassDirection] = useState<'all' | 'in' | 'out'>('all');
  /** groupKey → selected */
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());
  /** groupKey → gl account id string */
  const [massGlByGroup, setMassGlByGroup] = useState<Record<string, string>>({});

  const [accForm, setAccForm] = useState({
    name: '',
    bank_name: 'FNB',
    account_number: '',
    account_type: 'current',
    currency: 'ZAR',
    opening_balance: '0',
    provider: 'manual',
    gl_account_id: '',
  });

  const [importForm, setImportForm] = useState({
    bank_account_id: '',
    format: 'auto',
    csv: '',
    pdfBase64: '',
    filename: '',
    kind: 'pdf' as 'csv' | 'pdf',
  });
  /** Keep raw File for multipart PDF upload (more reliable than base64 JSON). */
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown> | null>(null);

  const [allocForm, setAllocForm] = useState({
    gl_account_id: '',
    memo: '',
    tax_amount: '',
  });
  const [matchInvoiceId, setMatchInvoiceId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkGl, setBulkGl] = useState('');
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [bankProvider, setBankProvider] = useState<BankingProviderInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showAutoMatch, setShowAutoMatch] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [autoMatchPreview, setAutoMatchPreview] = useState<Record<string, unknown> | null>(
    null
  );
  const [autoMatching, setAutoMatching] = useState(false);
  const [matchRules, setMatchRules] = useState<
    Array<{
      id: number;
      name: string;
      match_type: string;
      pattern: string;
      target_type: string;
      target_id?: number | null;
      priority?: number;
      is_active?: boolean;
    }>
  >([]);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    pattern: '',
    match_type: 'description_contains',
    target_type: 'gl_account',
    target_id: '',
    priority: '50',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        include: 'transactions',
        limit: '500',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (selectedAccount) params.set('accountId', String(selectedAccount));
      if (allocFilter !== 'all') params.set('allocation_status', allocFilter);

      const coaParams = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) coaParams.set('privyUserId', privyUserId);

      const connParams = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) connParams.set('privyUserId', privyUserId);

      const [bankRes, coaRes, connRes] = await Promise.all([
        fetch(`/api/accounting/bank?${params}`),
        fetch(`/api/accounting/chart-of-accounts?${coaParams}`),
        fetch(`/api/banking/connections?${connParams}`),
      ]);
      const bankData = await bankRes.json();
      const coaData = await coaRes.json();
      const connData = await connRes.json();
      setAccounts(bankData.accounts || []);
      setTransactions(bankData.transactions || []);
      setPulse(bankData.pulse || null);
      setCoa((coaData.accounts || []).filter((a: CoaAccount) => !a.is_header && a.is_active !== false));
      setConnections(connData.connections || []);
      setBankProvider(connData.provider || null);
      if (bankData.warning) toast.message(bankData.warning, { description: bankData.hint });
    } catch {
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, selectedAccount, allocFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Complete bank link after redirect (?bank_link=1&session=…)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('bank_link') !== '1') return;
    const session = sp.get('session');
    if (!session) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/banking/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'complete',
            sessionId: session,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Link complete failed');
        toast.success(data.message || 'Bank connected');
        if (data.ingest) {
          toast.message(
            `Synced ${data.ingest.inserted} new · ${data.ingest.duplicates} duplicates`
          );
        }
        // Clean query string
        const url = new URL(window.location.href);
        url.searchParams.delete('bank_link');
        url.searchParams.delete('session');
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.pathname + url.search);
        void load();
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Could not complete bank link');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId, load]);

  const activeConnections = useMemo(
    () => connections.filter((c) => c.status === 'active'),
    [connections]
  );

  async function startBankConnect() {
    setConnecting(true);
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/accounting/bank-reconciliation`
          : '/dashboard/accounting/bank-reconciliation';
      const res = await fetch('/api/banking/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'start',
          bank_account_id: selectedAccount || undefined,
          returnUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connect failed');

      if (data.mode === 'sandbox') {
        // Complete in-app without leaving the page
        const done = await fetch('/api/banking/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'complete',
            connectionId: data.connection?.id,
            sessionId: data.sessionId,
          }),
        });
        const doneData = await done.json();
        if (!done.ok) throw new Error(doneData.error || 'Sandbox complete failed');
        toast.success(doneData.message || 'Sandbox bank connected');
        if (doneData.ingest) {
          toast.message(
            `Imported ${doneData.ingest.inserted} sample lines · ${doneData.ingest.duplicates} duplicates`
          );
        }
        setShowConnect(false);
        void load();
        return;
      }

      if (data.url) {
        toast.message('Redirecting to bank link…', {
          description: data.message || 'Authorise your account securely',
        });
        window.location.href = data.url;
        return;
      }
      toast.success('Connection started');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setConnecting(false);
    }
  }

  async function syncConnection(connectionId?: number) {
    setSyncing(true);
    try {
      const res = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          connectionId: connectionId || activeConnections[0]?.id,
          bank_account_id: selectedAccount || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast.success(
        `Synced ${data.ingest?.inserted ?? 0} new · ${data.ingest?.duplicates ?? 0} duplicates`
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectBank(connectionId: number) {
    try {
      const res = await fetch('/api/banking/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, connectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');
      toast.success('Bank connection revoked');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function runAutoMatchPreview() {
    setAutoMatching(true);
    try {
      const res = await fetch('/api/banking/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          dryRun: true,
          seedRules: true,
          minConfidence: 70,
          bank_account_id: selectedAccount || undefined,
          limit: 200,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-match failed');
      setAutoMatchPreview(data);
      toast.success(
        `Scanned ${data.scanned} · ${data.suggested} suggestions · ${
          (data.results || []).filter(
            (r: { confidence?: number }) => (r.confidence || 0) >= 80
          ).length
        } ready to apply (≥80%)`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auto-match failed');
    } finally {
      setAutoMatching(false);
    }
  }

  async function applyAutoMatch() {
    setAutoMatching(true);
    try {
      const res = await fetch('/api/banking/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          dryRun: false,
          apply: true,
          seedRules: true,
          minConfidence: 80,
          bank_account_id: selectedAccount || undefined,
          limit: 200,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Apply failed');
      setAutoMatchPreview(data);
      toast.success(
        `Applied ${data.applied} matches · ${data.errors || 0} errors · ${data.skipped || 0} skipped`
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setAutoMatching(false);
    }
  }

  async function loadMatchRules() {
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        seed: '1',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/banking/match-rules?${params}`);
      const data = await res.json();
      setMatchRules(data.rules || []);
      if (data.seeded > 0) {
        toast.message(`Seeded ${data.seeded} default rules`);
      }
    } catch {
      setMatchRules([]);
    }
  }

  async function createMatchRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.name || !ruleForm.pattern) {
      toast.error('Name and pattern required');
      return;
    }
    if (ruleForm.target_type === 'gl_account' && !ruleForm.target_id) {
      toast.error('Select a GL account');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/banking/match-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: ruleForm.name,
          pattern: ruleForm.pattern,
          match_type: ruleForm.match_type,
          target_type: ruleForm.target_type,
          target_id: ruleForm.target_id ? Number(ruleForm.target_id) : null,
          priority: Number(ruleForm.priority) || 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Rule created');
      setRuleForm({
        name: '',
        pattern: '',
        match_type: 'description_contains',
        target_type: 'gl_account',
        target_id: '',
        priority: '50',
      });
      void loadMatchRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMatchRule(id: number) {
    try {
      const res = await fetch('/api/banking/match-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Rule deleted');
      void loadMatchRules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  const coaById = useMemo(() => {
    const m: Record<number, CoaAccount> = {};
    for (const a of coa) m[a.id] = a;
    return m;
  }, [coa]);

  const plAccounts = useMemo(
    () =>
      coa.filter((a) =>
        ['revenue', 'expense', 'cogs', 'asset', 'liability', 'equity'].includes(
          String(a.account_type)
        )
      ),
    [coa]
  );

  const incomeExpenseAccounts = useMemo(
    () => coa.filter((a) => ['revenue', 'expense', 'cogs'].includes(String(a.account_type))),
    [coa]
  );

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'account',
          ...accForm,
          opening_balance: Number(accForm.opening_balance || 0),
          gl_account_id: accForm.gl_account_id ? Number(accForm.gl_account_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Bank account created');
      setShowAccount(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function buildImportRequest(dryRun: boolean): { init: RequestInit; error?: string } {
    if (!importForm.bank_account_id) {
      return { init: {}, error: 'Select a bank account' };
    }
    if (importForm.kind === 'pdf') {
      if (!importFile && !importForm.pdfBase64) {
        return { init: {}, error: 'Upload a PDF statement' };
      }
      // Prefer multipart with the raw File — avoids base64 body-size issues
      if (importFile) {
        const form = new FormData();
        form.set('companyId', String(companyId));
        if (privyUserId) form.set('privyUserId', privyUserId);
        form.set('bank_account_id', String(importForm.bank_account_id));
        form.set('format', importForm.format || 'auto');
        form.set('filename', importForm.filename || importFile.name);
        form.set('dryRun', dryRun ? 'true' : 'false');
        form.set('file', importFile);
        return { init: { method: 'POST', body: form } };
      }
      return {
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            bank_account_id: Number(importForm.bank_account_id),
            format: importForm.format,
            filename: importForm.filename || null,
            dryRun,
            pdfBase64: importForm.pdfBase64,
          }),
        },
      };
    }
    if (!importForm.csv.trim()) {
      return { init: {}, error: 'Paste or upload CSV' };
    }
    return {
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          bank_account_id: Number(importForm.bank_account_id),
          format: importForm.format,
          filename: importForm.filename || null,
          dryRun,
          csv: importForm.csv,
        }),
      },
    };
  }

  function importErrorMessage(data: Record<string, unknown>, fallback: string): string {
    const base = String(data.error || fallback);
    const warnings = Array.isArray(data.warnings)
      ? (data.warnings as string[]).filter(Boolean).slice(0, 2)
      : [];
    if (warnings.length) return `${base} — ${warnings.join(' ')}`;
    return base;
  }

  async function dryRunImport() {
    const { init, error } = buildImportRequest(true);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/import', init);
      const data = await res.json();
      if (!res.ok) {
        setImportPreview(data);
        throw new Error(importErrorMessage(data, 'Parse failed'));
      }
      setImportPreview(data);
      toast.success(
        `Preview: ${data.wouldImport} new · ${data.duplicates} duplicates${
          data.source === 'pdf' ? ' (from PDF)' : ''
        }`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function runImport() {
    const { init, error } = buildImportRequest(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/import', init);
      const data = await res.json();
      if (!res.ok) {
        setImportPreview(data);
        throw new Error(importErrorMessage(data, 'Import failed'));
      }
      toast.success(`Imported ${data.imported} lines (${data.duplicates} duplicates skipped)`);
      if (data.auto_matched > 0) {
        toast.message(`Auto-matched ${data.auto_matched} high-confidence lines`);
      }
      if (data.statement?.url) {
        toast.message('Statement PDF saved', { description: 'Stored with this import batch' });
      }
      setShowImport(false);
      setImportPreview(null);
      setImportFile(null);
      setImportForm({
        bank_account_id: '',
        format: 'auto',
        csv: '',
        pdfBase64: '',
        filename: '',
        kind: 'pdf',
      });
      setAllocFilter('unallocated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function downloadCsvFromPreview() {
    const csv = importPreview?.csv;
    if (typeof csv !== 'string' || !csv) {
      toast.error('No CSV available — run Preview first');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (importForm.filename || 'statement').replace(/\.pdf$/i, '') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }

  function onFile(file: File | null) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
    const isOfx =
      lower.endsWith('.ofx') ||
      lower.endsWith('.qfx') ||
      file.type.includes('ofx');
    setImportPreview(null);
    if (isPdf || isOfx) {
      setImportFile(file);
      // Multipart for binary; also keep text for OFX fallback
      if (isOfx) {
        const reader = new FileReader();
        reader.onload = () => {
          setImportForm((f) => ({
            ...f,
            filename: file.name,
            kind: 'csv',
            csv: String(reader.result || ''),
            pdfBase64: '',
            format: 'auto',
          }));
        };
        reader.readAsText(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        setImportForm((f) => ({
          ...f,
          filename: file.name,
          kind: 'pdf',
          pdfBase64: result,
          csv: '',
        }));
      };
      reader.onerror = () => {
        setImportForm((f) => ({
          ...f,
          filename: file.name,
          kind: 'pdf',
          pdfBase64: '',
          csv: '',
        }));
      };
      reader.readAsDataURL(file);
      return;
    }
    setImportFile(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImportForm((f) => ({
        ...f,
        filename: file.name,
        kind: 'csv',
        csv: String(reader.result || ''),
        pdfBase64: '',
      }));
    };
    reader.readAsText(file);
  }

  async function allocateOne(e: React.FormEvent) {
    e.preventDefault();
    if (!showAllocate || !allocForm.gl_account_id) return;
    setSaving(true);
    try {
      const alreadyAllocated = ['allocated', 'matched_invoice'].includes(
        String(showAllocate.allocation_status || '')
      );
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: alreadyAllocated ? 'reallocate' : 'allocate',
          bank_transaction_id: showAllocate.id,
          gl_account_id: Number(allocForm.gl_account_id),
          memo: allocForm.memo || null,
          tax_amount: allocForm.tax_amount ? Number(allocForm.tax_amount) : 0,
          tax_code: showAllocate.tax_code || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        alreadyAllocated
          ? `Re-allocated · journal ${data.entryNumber}`
          : `Allocated · journal ${data.entryNumber}`
      );
      setShowAllocate(null);
      setAllocForm({ gl_account_id: '', memo: '', tax_amount: '' });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function bulkAllocate() {
    if (!bulkGl || selectedIds.size === 0) {
      toast.error('Select lines and a GL account');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bulk_allocate',
          ids: [...selectedIds],
          gl_account_id: Number(bulkGl),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Allocated ${data.allocated}, failed ${data.failed}`);
      if (data.failed > 0 && Array.isArray(data.results)) {
        const firstErr = data.results.find((r: { ok: boolean; error?: string }) => !r.ok);
        if (firstErr?.error) toast.message('Some failed', { description: firstErr.error });
      }
      setSelectedIds(new Set());
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function openMassAllocate() {
    setShowMassAlloc(true);
    setMassLoading(true);
    setMassSearch('');
    setMassDirection('all');
    try {
      let coaRows = coa;

      // Ensure CoA exists for suggestions + journals
      if (incomeExpenseAccounts.length === 0) {
        const seedParams = new URLSearchParams({
          companyId: String(companyId),
          seed: '1',
        });
        if (privyUserId) seedParams.set('privyUserId', privyUserId);
        const seedRes = await fetch(`/api/accounting/chart-of-accounts?${seedParams}`);
        const seedData = await seedRes.json();
        if (seedData.accounts?.length) {
          coaRows = (seedData.accounts as CoaAccount[]).filter(
            (a) => !a.is_header && a.is_active !== false
          );
          setCoa(coaRows);
          if (seedData.seeded) {
            toast.message('Chart of accounts seeded', {
              description: 'Default GL accounts created for allocation',
            });
          }
        }
      }

      const params = new URLSearchParams({
        companyId: String(companyId),
        include: 'transactions',
        allocation_status: 'unallocated',
        limit: '1000',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (selectedAccount) params.set('accountId', String(selectedAccount));
      const res = await fetch(`/api/accounting/bank?${params}`);
      const data = await res.json();
      const rows = (data.transactions || []) as BankTransaction[];
      setMassTxns(rows);

      const groups = groupTransactionsForMassAlloc(rows, coaRows);
      setMassSelected(new Set(groups.map((g) => g.key)));
      const glMap: Record<string, string> = {};
      for (const g of groups) {
        if (g.suggestedGlId) glMap[g.key] = String(g.suggestedGlId);
      }
      setMassGlByGroup(glMap);

      if (!rows.length) {
        toast.message('Nothing to allocate', {
          description: 'Import a bank statement first',
        });
      }
    } catch {
      setMassTxns([]);
      toast.error('Could not load unallocated transactions');
    } finally {
      setMassLoading(false);
    }
  }

  const massGroups: MassAllocGroup[] = useMemo(() => {
    let rows = massTxns;
    if (massDirection === 'in') rows = rows.filter((t) => Number(t.amount) > 0);
    if (massDirection === 'out') rows = rows.filter((t) => Number(t.amount) < 0);
    if (massSearch.trim()) {
      const q = massSearch.trim().toLowerCase();
      rows = rows.filter((t) => String(t.description || '').toLowerCase().includes(q));
    }
    return groupTransactionsForMassAlloc(rows, coa);
  }, [massTxns, massSearch, massDirection, coa]);

  const massStats = useMemo(() => {
    let lines = 0;
    let withGl = 0;
    for (const g of massGroups) {
      if (!massSelected.has(g.key)) continue;
      lines += g.count;
      if (massGlByGroup[g.key]) withGl += g.count;
    }
    return { groups: massSelected.size, lines, withGl };
  }, [massGroups, massSelected, massGlByGroup]);

  function applyAllSuggestions() {
    const next = { ...massGlByGroup };
    const sel = new Set(massSelected);
    for (const g of massGroups) {
      if (g.suggestedGlId) {
        next[g.key] = String(g.suggestedGlId);
        sel.add(g.key);
      }
    }
    setMassGlByGroup(next);
    setMassSelected(sel);
    toast.success('Applied suggested GL accounts to matching groups');
  }

  async function runMassAllocate() {
    const assignments: Array<{ ids: Array<string | number>; gl_account_id: number }> = [];
    for (const g of massGroups) {
      if (!massSelected.has(g.key)) continue;
      const gl = Number(massGlByGroup[g.key]);
      if (!Number.isFinite(gl) || gl <= 0) continue;
      assignments.push({ ids: g.ids, gl_account_id: gl });
    }
    if (!assignments.length) {
      toast.error('Select groups and choose a GL account for each');
      return;
    }
    const total = assignments.reduce((s, a) => s + a.ids.length, 0);
    setSaving(true);
    try {
      // Chunk assignments if many lines
      let allocated = 0;
      let failed = 0;
      let firstError = '';
      const chunkSize = 80;
      // Flatten into chunks of ids with same gl
      const flat: Array<{ id: string | number; gl: number }> = [];
      for (const a of assignments) {
        for (const id of a.ids) flat.push({ id, gl: a.gl_account_id });
      }
      for (let i = 0; i < flat.length; i += chunkSize) {
        const slice = flat.slice(i, i + chunkSize);
        // group slice by gl
        const byGl = new Map<number, Array<string | number>>();
        for (const row of slice) {
          const list = byGl.get(row.gl) || [];
          list.push(row.id);
          byGl.set(row.gl, list);
        }
        const chunkAssignments = [...byGl.entries()].map(([gl_account_id, ids]) => ({
          ids,
          gl_account_id,
        }));
        const res = await fetch('/api/accounting/bank/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'mass_allocate',
            assignments: chunkAssignments,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Mass allocate failed');
        allocated += Number(data.allocated || 0);
        failed += Number(data.failed || 0);
        if (!firstError && Array.isArray(data.results)) {
          const err = data.results.find((r: { ok: boolean; error?: string }) => !r.ok);
          if (err?.error) firstError = err.error;
        }
      }
      toast.success(`Mass allocated ${allocated} of ${total} lines`);
      if (failed > 0) {
        toast.message(`${failed} failed`, {
          description: firstError || 'Check chart of accounts / bank GL link',
        });
      }
      setShowMassAlloc(false);
      setSelectedIds(new Set());
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function openMatch(txn: BankTransaction) {
    setShowMatch(txn);
    setMatchInvoiceId('');
    const dir = Number(txn.amount) > 0 ? 'receivable' : 'payable';
    const params = new URLSearchParams({
      companyId: String(companyId),
      direction: dir,
    });
    if (privyUserId) params.set('privyUserId', privyUserId);
    const res = await fetch(`/api/accounting/invoices?${params}`);
    const data = await res.json();
    setInvoices(
      (data.invoices || []).filter(
        (i: AccountingInvoice) =>
          !['paid', 'void', 'cancelled'].includes(String(i.status)) &&
          Number(i.balance_due || i.total_amount || 0) > 0
      )
    );
  }

  async function matchInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!showMatch || !matchInvoiceId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'match_invoice',
          bank_transaction_id: showMatch.id,
          invoice_id: Number(matchInvoiceId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Matched to invoice & payment recorded');
      setShowMatch(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function exclude(id: string | number) {
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'exclude',
          bank_transaction_id: id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Excluded');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  /** Undo wrong GL/VAT allocation — voids linked journal and returns line to unallocated */
  async function unallocate(id: string | number, clearTax = false) {
    if (
      !window.confirm(
        clearTax
          ? 'Unallocate and clear VAT code? Linked journal will be voided.'
          : 'Unallocate this line? The linked journal will be voided so you can re-allocate with the correct GL/VAT.'
      )
    ) {
      return;
    }
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'unallocate',
          bank_transaction_id: id,
          clear_tax: clearTax,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.results?.[0]?.voidedJournalId
          ? 'Unallocated — journal voided. Re-allocate when ready.'
          : 'Unallocated'
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function reconcile(id: string | number, action: 'reconcile' | 'unreconcile') {
    try {
      const res = await fetch('/api/accounting/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, action, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  function toggleSelect(id: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const unalloc = transactions.filter(
      (t) => (t.allocation_status || 'unallocated') === 'unallocated'
    );
    setSelectedIds(new Set(unalloc.map((t) => t.id)));
  }

  const totalBalance = accounts
    .filter((a) => a.status !== 'closed')
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Bank &"
        titleAccent="allocation"
        description="Connect FNB via BankLink (or sandbox), import PDF/CSV statements, allocate to the GL, and match AR/AP — one middleware for every source."
        action={
          <>
            <button
              type="button"
              onClick={() => setShowAccount(true)}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Account
            </button>
            <button
              type="button"
              onClick={() => setShowConnect(true)}
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <Wifi className="w-4 h-4" /> Connect bank
            </button>
            {activeConnections.length > 0 && (
              <button
                type="button"
                onClick={() => void syncConnection()}
                disabled={syncing}
                className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync feed
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAutoMatchPreview(null);
                setShowAutoMatch(true);
                void runAutoMatchPreview();
              }}
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              disabled={!pulse?.unallocated}
              title="Score unallocated lines against AR/AP and rules"
            >
              <Wand2 className="w-4 h-4" /> Auto-match
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRules(true);
                void loadMatchRules();
              }}
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <ListFilter className="w-4 h-4" /> Match rules
            </button>
            <button
              type="button"
              onClick={() => void openMassAllocate()}
              className="btn-secondary !py-2.5 !px-5 text-sm"
              disabled={!pulse?.unallocated}
              title={
                pulse?.unallocated
                  ? 'Allocate many transactions at once by group'
                  : 'No unallocated transactions'
              }
            >
              <Layers className="w-4 h-4" /> Mass allocate
              {(pulse?.unallocated || 0) > 0 ? ` (${pulse?.unallocated})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                if (accounts.length === 0) {
                  toast.error('Add a bank account first, then import your statement PDF');
                  setShowAccount(true);
                  return;
                }
                setImportForm((f) => ({
                  ...f,
                  kind: 'pdf',
                  bank_account_id: selectedAccount
                    ? String(selectedAccount)
                    : accounts[0]
                      ? String(accounts[0].id)
                      : '',
                }));
                setImportFile(null);
                setImportPreview(null);
                setShowImport(true);
              }}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Upload className="w-4 h-4" /> Import PDF/CSV
            </button>
          </>
        }
      />

      {/* Live bank feeds */}
      {(activeConnections.length > 0 || bankProvider) && (
        <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50/40 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                Bank feed middleware
              </div>
              <p className="text-sm text-slate-600 mt-0.5">
                {bankProvider?.mode === 'sandbox' || !bankProvider?.configured
                  ? 'Sandbox mode — demo FNB feed without API keys. Set BANKLINK_API_KEY for live BankLink.'
                  : 'Live BankLink mode — FNB and roadmap banks via open-banking style link.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  bankProvider?.configured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {bankProvider?.configured ? 'API configured' : 'Sandbox'}
              </span>
              {bankProvider?.docs && (
                <a
                  href={bankProvider.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#00b4d8] hover:underline"
                >
                  BankLink docs
                </a>
              )}
            </div>
          </div>
          {activeConnections.length === 0 ? (
            <p className="text-xs text-slate-500">
              No active connections. Use <strong>Connect bank</strong> or keep using PDF/CSV import.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeConnections.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white bg-white/90 px-3 py-2.5 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-sm">
                      {c.bank_name || 'Bank'} · {c.account_name || 'Account'}
                      {c.account_mask ? ` ·••${c.account_mask}` : ''}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {c.provider} ·{' '}
                      {c.last_sync_at
                        ? `Last sync ${new Date(c.last_sync_at).toLocaleString()}`
                        : 'Never synced'}
                      {c.last_error ? ` · ${c.last_error}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void syncConnection(c.id)}
                      disabled={syncing}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-cyan-200 text-[#0077b6] hover:bg-sky-50"
                    >
                      Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnectBank(c.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 inline-flex items-center gap-1"
                    >
                      <Unplug className="w-3 h-3" /> Disconnect
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">
            Bank balance
          </div>
          <div className="text-2xl font-black tabular-nums text-emerald-950">
            {formatMoney(totalBalance)}
          </div>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
            Unallocated
          </div>
          <div className="text-2xl font-black tabular-nums text-amber-950">
            {pulse?.unallocated ?? 0}
          </div>
          <div className="text-[11px] text-amber-900/70 mt-1">
            In {formatMoney(pulse?.unallocatedIn ?? 0)} · Out{' '}
            {formatMoney(pulse?.unallocatedOut ?? 0)}
          </div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Allocated
          </div>
          <div className="text-2xl font-black tabular-nums">
            {(pulse?.allocated ?? 0) + (pulse?.matched_invoice ?? 0)}
          </div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Accounts
          </div>
          <div className="text-2xl font-black tabular-nums">{accounts.length}</div>
        </div>
      </div>

      <SectionLabel>Bank accounts</SectionLabel>
      {loading && accounts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : accounts.length === 0 ? (
        <Panel className="mb-8">
          <div className="px-6 py-12 text-center text-sm text-neutral-500 space-y-3">
            <p>
              Add your FNB/RMB operating account, then import a bank statement PDF to start
              allocating for management accounts.
            </p>
            <button
              type="button"
              onClick={() => setShowAccount(true)}
              className="btn-primary !py-2 !px-4 text-sm inline-flex"
            >
              <Plus className="w-4 h-4" /> Add bank account
            </button>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                setSelectedAccount(selectedAccount === a.id ? null : a.id)
              }
              className={`text-left rounded-3xl border p-5 transition-all ${
                selectedAccount === a.id
                  ? 'border-[#00b4d8] shadow-md bg-white'
                  : 'border-neutral-200 bg-white hover:border-[#00b4d8]/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-[#00b4d8]" />
                </div>
                {(a.unreconciled_count || 0) > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100">
                    {a.unreconciled_count} open
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900">{a.name}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {a.bank_name || a.provider || a.account_type}
                {a.account_number ? ` · ··${String(a.account_number).slice(-4)}` : ''}
              </div>
              <div className="text-xl font-black tabular-nums mt-3 text-slate-900">
                {formatMoney(a.current_balance, a.currency || 'ZAR')}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <SectionLabel>Transactions</SectionLabel>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={allocFilter}
            onChange={(e) => setAllocFilter(e.target.value)}
            className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white"
          >
            <option value="unallocated">Unallocated</option>
            <option value="allocated">Allocated</option>
            <option value="matched_invoice">Matched invoice</option>
            <option value="excluded">Excluded</option>
            <option value="all">All</option>
          </select>
          {selectedIds.size > 0 && (
            <>
              <select
                value={bulkGl}
                onChange={(e) => setBulkGl(e.target.value)}
                className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white max-w-[200px]"
              >
                <option value="">Bulk GL account…</option>
                {plAccounts
                  .filter((a) =>
                    ['revenue', 'expense', 'cogs', 'liability', 'equity'].includes(
                      String(a.account_type)
                    )
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => void bulkAllocate()}
                disabled={saving || !bulkGl}
                className="btn-primary !py-2 !px-3 text-xs"
              >
                <Tags className="w-3.5 h-3.5" /> Allocate {selectedIds.size}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={selectAllVisible}
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Select unallocated
          </button>
          <button
            type="button"
            onClick={() => void openMassAllocate()}
            className="text-xs font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" /> Mass allocate
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 rounded-2xl border border-[#00b4d8]/40 bg-[#00b4d8]/5 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-slate-800">
            {selectedIds.size} line{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <select
            value={bulkGl}
            onChange={(e) => setBulkGl(e.target.value)}
            className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white min-w-[200px]"
          >
            <option value="">Choose GL account…</option>
            {plAccounts
              .filter((a) =>
                ['revenue', 'expense', 'cogs', 'liability', 'equity'].includes(
                  String(a.account_type)
                )
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => void bulkAllocate()}
            disabled={saving || !bulkGl}
            className="btn-primary !py-2 !px-4 text-xs"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Tags className="w-3.5 h-3.5" /> Allocate selected
              </>
            )}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-neutral-500 hover:underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            No transactions. Import a bank CSV to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-3 py-3 w-8" />
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Description</th>
                  <th className="px-3 py-3 font-semibold">Ref</th>
                  <th className="px-3 py-3 font-semibold text-right">Amount</th>
                  <th className="px-3 py-3 font-semibold">Allocation</th>
                  <th className="px-3 py-3 font-semibold">GL</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {transactions.map((t) => {
                  const alloc = t.allocation_status || 'unallocated';
                  const gl = t.gl_account_id ? coaById[t.gl_account_id] : null;
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/80">
                      <td className="px-3 py-2.5">
                        {alloc === 'unallocated' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-neutral-500 whitespace-nowrap">
                        {t.txn_date}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 max-w-[240px]">
                        <div className="truncate font-medium">{t.description || '—'}</div>
                        {t.counterparty_name && (
                          <div className="text-[11px] text-neutral-400 truncate">
                            {t.counterparty_name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">
                        {t.reference || '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                          Number(t.amount) >= 0 ? 'text-emerald-700' : 'text-slate-800'
                        }`}
                      >
                        {formatMoney(t.amount, t.currency || 'ZAR')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(alloc)}`}
                        >
                          {alloc.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600">
                        {gl ? `${gl.code}` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          {alloc === 'unallocated' && (
                            <>
                              <IconBtn
                                title="Allocate to GL"
                                onClick={() => {
                                  setShowAllocate(t);
                                  setAllocForm({
                                    gl_account_id: '',
                                    memo: t.description || '',
                                    tax_amount: '',
                                  });
                                }}
                              >
                                <Tags className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn title="Match invoice" onClick={() => void openMatch(t)}>
                                <Link2 className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn title="Exclude" onClick={() => void exclude(t.id)}>
                                <Ban className="w-3.5 h-3.5" />
                              </IconBtn>
                            </>
                          )}
                          {(alloc === 'allocated' || alloc === 'matched_invoice') && (
                            <>
                              <IconBtn
                                title="Unallocate (void journal — fix wrong GL/VAT)"
                                onClick={() => void unallocate(t.id, false)}
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn
                                title="Unallocate & clear VAT code"
                                onClick={() => void unallocate(t.id, true)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn
                                title="Re-allocate to different GL"
                                onClick={() => {
                                  setShowAllocate(t);
                                  setAllocForm({
                                    gl_account_id: t.gl_account_id
                                      ? String(t.gl_account_id)
                                      : '',
                                    memo: t.description || '',
                                    tax_amount:
                                      t.tax_amount != null && Number(t.tax_amount) > 0
                                        ? String(t.tax_amount)
                                        : '',
                                  });
                                }}
                              >
                                <Tags className="w-3.5 h-3.5" />
                              </IconBtn>
                            </>
                          )}
                          {t.status === 'unreconciled' && alloc !== 'unallocated' && (
                            <IconBtn
                              title="Mark reconciled"
                              onClick={() => void reconcile(t.id, 'reconcile')}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </IconBtn>
                          )}
                          {t.status === 'reconciled' && (
                            <IconBtn
                              title="Unreconcile"
                              onClick={() => void reconcile(t.id, 'unreconcile')}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New account modal */}
      {showAccount && (
        <Modal title="New bank account" onClose={() => setShowAccount(false)}>
          <form onSubmit={createAccount} className="space-y-3">
            <Field label="Name" required>
              <input
                required
                value={accForm.name}
                onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                className="input"
                placeholder="FNB Operating"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank">
                <input
                  value={accForm.bank_name}
                  onChange={(e) => setAccForm({ ...accForm, bank_name: e.target.value })}
                  className="input"
                  placeholder="FNB / RMB"
                />
              </Field>
              <Field label="Account number">
                <input
                  value={accForm.account_number}
                  onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Opening balance">
              <input
                type="number"
                step="0.01"
                value={accForm.opening_balance}
                onChange={(e) => setAccForm({ ...accForm, opening_balance: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Linked GL cash account">
              <select
                value={accForm.gl_account_id}
                onChange={(e) => setAccForm({ ...accForm, gl_account_id: e.target.value })}
                className="input"
              >
                <option value="">Auto (1110 Bank)</option>
                {plAccounts
                  .filter((a) => a.account_type === 'asset')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowAccount(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Mass allocate modal */}
      {showMassAlloc && (
        <Modal
          title="Mass allocate"
          onClose={() => setShowMassAlloc(false)}
          wide
        >
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Similar bank lines are grouped (e.g. all Shell fuel, all Tapngo). Pick a GL
              account per group — or apply suggestions — then allocate everything in one go.
              Journals are posted for management accounts.
            </p>

            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={massSearch}
                onChange={(e) => setMassSearch(e.target.value)}
                placeholder="Filter description…"
                className="input !py-2 text-xs max-w-[220px]"
              />
              <select
                value={massDirection}
                onChange={(e) =>
                  setMassDirection(e.target.value as 'all' | 'in' | 'out')
                }
                className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white"
              >
                <option value="all">In + out</option>
                <option value="out">Money out only</option>
                <option value="in">Money in only</option>
              </select>
              <button
                type="button"
                onClick={applyAllSuggestions}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" /> Apply suggestions
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-[#00b4d8] hover:underline"
                onClick={() => setMassSelected(new Set(massGroups.map((g) => g.key)))}
              >
                Select all groups
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-neutral-500 hover:underline"
                onClick={() => setMassSelected(new Set())}
              >
                Clear
              </button>
            </div>

            {massLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
              </div>
            ) : massGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                No unallocated transactions to group.
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
                {massGroups.map((g) => {
                  const checked = massSelected.has(g.key);
                  return (
                    <div
                      key={g.key}
                      className={`px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2 ${
                        checked ? 'bg-white' : 'bg-neutral-50/80 opacity-70'
                      }`}
                    >
                      <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => {
                            setMassSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(g.key)) next.delete(g.key);
                              else next.add(g.key);
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0">
                          <span className="font-semibold text-sm text-slate-900 block truncate">
                            {g.label}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            {g.count} line{g.count === 1 ? '' : 's'}
                            {g.totalOut > 0 ? ` · Out ${formatMoney(g.totalOut)}` : ''}
                            {g.totalIn > 0 ? ` · In ${formatMoney(g.totalIn)}` : ''}
                          </span>
                          {g.sampleDescriptions[0] && (
                            <span className="block text-[10px] text-neutral-400 truncate max-w-[280px]">
                              e.g. {g.sampleDescriptions[0]}
                            </span>
                          )}
                        </span>
                      </label>
                      <div className="sm:w-56 flex-shrink-0">
                        <select
                          value={massGlByGroup[g.key] || ''}
                          onChange={(e) => {
                            setMassGlByGroup((m) => ({ ...m, [g.key]: e.target.value }));
                            if (e.target.value) {
                              setMassSelected((prev) => new Set(prev).add(g.key));
                            }
                          }}
                          className="input !py-1.5 text-xs w-full"
                        >
                          <option value="">GL account…</option>
                          {plAccounts
                            .filter((a) =>
                              [
                                'revenue',
                                'expense',
                                'cogs',
                                'liability',
                                'equity',
                                'asset',
                              ].includes(String(a.account_type))
                            )
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} · {a.name}
                              </option>
                            ))}
                        </select>
                        {g.suggestedGlLabel && (
                          <div className="text-[10px] text-emerald-700 mt-0.5 truncate">
                            Suggested: {g.suggestedGlLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-100">
              <div className="text-xs text-neutral-500">
                {massStats.withGl} of {massStats.lines} selected lines have a GL ·{' '}
                {massGroups.length} groups
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-4 text-sm"
                  onClick={() => setShowMassAlloc(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary !py-2 !px-4 text-sm"
                  disabled={saving || massStats.withGl === 0}
                  onClick={() => void runMassAllocate()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Tags className="w-4 h-4" /> Allocate {massStats.withGl || ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Auto-match modal */}
      {showAutoMatch && (
        <Modal title="Auto-match bank lines" onClose={() => setShowAutoMatch(false)} wide>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Scores unallocated lines against open AR/AP invoices and CRM customer
              invoices (trade-loop receivables) using reference, amount, date, and
              counterparty — plus your match rules and keyword heuristics. Apply only
              high-confidence matches (≥80%). CRM matches post to the AR payment ledger.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
                disabled={autoMatching}
                onClick={() => void runAutoMatchPreview()}
              >
                {autoMatching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Re-score
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-5 text-sm inline-flex items-center gap-2"
                disabled={autoMatching}
                onClick={() => void applyAutoMatch()}
              >
                {autoMatching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Apply ≥80% matches
              </button>
            </div>
            {autoMatchPreview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Scanned', v: autoMatchPreview.scanned },
                  { l: 'Suggestions', v: autoMatchPreview.suggested },
                  { l: 'Applied', v: autoMatchPreview.applied },
                  { l: 'Skipped', v: autoMatchPreview.skipped },
                ].map((c) => (
                  <div
                    key={c.l}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="text-lg font-black tabular-nums text-slate-900">
                      {String(c.v ?? 0)}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-neutral-400">{c.l}</div>
                  </div>
                ))}
              </div>
            )}
            {autoMatchPreview && Array.isArray(autoMatchPreview.results) && (
              <div className="max-h-[45vh] overflow-y-auto rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
                {(
                  autoMatchPreview.results as Array<{
                    bank_transaction_id: string | number;
                    applied?: boolean;
                    action?: string;
                    confidence?: number;
                    detail?: string;
                    error?: string;
                    suggestions?: Array<{ kind: string; confidence: number; reason?: string }>;
                  }>
                )
                  .filter((r) => (r.confidence || 0) >= 50 || r.applied || r.error)
                  .slice(0, 80)
                  .map((r) => (
                    <div
                      key={String(r.bank_transaction_id)}
                      className="px-3 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
                    >
                      <span className="font-mono text-neutral-400 shrink-0">
                        #{String(r.bank_transaction_id).slice(0, 8)}
                      </span>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          (r.confidence || 0) >= 80
                            ? 'text-emerald-700'
                            : (r.confidence || 0) >= 60
                              ? 'text-amber-700'
                              : 'text-neutral-500'
                        }`}
                      >
                        {r.confidence != null ? `${r.confidence}%` : '—'}
                      </span>
                      <span className="text-slate-700 min-w-0 flex-1">
                        {r.error || r.detail || r.action || '—'}
                        {r.applied ? ' ✓' : ''}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {!autoMatchPreview && autoMatching && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Match rules modal */}
      {showRules && (
        <Modal title="Match rules" onClose={() => setShowRules(false)} wide>
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              When description/reference matches a pattern, auto-match can allocate to a GL account
              or exclude the line. Priority runs lowest number first.
            </p>
            <form onSubmit={createMatchRule} className="grid sm:grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
              <Field label="Name" required>
                <input
                  className="input"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="Bank fees"
                />
              </Field>
              <Field label="Pattern" required>
                <input
                  className="input"
                  value={ruleForm.pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                  placeholder="service fee"
                />
              </Field>
              <Field label="Match type">
                <select
                  className="input"
                  value={ruleForm.match_type}
                  onChange={(e) => setRuleForm({ ...ruleForm, match_type: e.target.value })}
                >
                  <option value="description_contains">Description contains</option>
                  <option value="reference_equals">Reference equals</option>
                  <option value="amount_equals">Amount equals</option>
                  <option value="description_regex">Description regex</option>
                </select>
              </Field>
              <Field label="Action">
                <select
                  className="input"
                  value={ruleForm.target_type}
                  onChange={(e) => setRuleForm({ ...ruleForm, target_type: e.target.value })}
                >
                  <option value="gl_account">Allocate to GL</option>
                  <option value="exclude">Exclude</option>
                </select>
              </Field>
              {ruleForm.target_type === 'gl_account' && (
                <Field label="GL account" required>
                  <select
                    className="input"
                    value={ruleForm.target_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, target_id: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {plAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Priority">
                <input
                  className="input"
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" className="btn-primary !py-2 !px-5 text-sm" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add rule'}
                </button>
              </div>
            </form>
            <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 max-h-[40vh] overflow-y-auto">
              {matchRules.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-neutral-500">
                  No rules yet. Defaults seed when you open Auto-match.
                </div>
              ) : (
                matchRules.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {r.match_type} · “{r.pattern}” → {r.target_type}
                        {r.target_id ? ` #${r.target_id}` : ''} · p{r.priority ?? 100}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-rose-600 p-1"
                      onClick={() => void deleteMatchRule(r.id)}
                      aria-label="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Connect bank modal */}
      {showConnect && (
        <Modal title="Connect bank feed" onClose={() => setShowConnect(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Link a South African bank account via BankLink open banking (FNB live; other banks on
              roadmap). Transactions land in the same allocation queue as PDF/CSV imports.
            </p>
            <div className="rounded-2xl border border-cyan-100 bg-sky-50/60 px-4 py-3 text-xs text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-900">How it works</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Authorise the bank (or use sandbox sample data).</li>
                <li>We create a connection + map to a GL bank account.</li>
                <li>Sync or receive webhooks into bank_transactions.</li>
                <li>Allocate / match as usual.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs">
              <div className="font-semibold text-slate-800 mb-1">Provider status</div>
              <p className="text-neutral-600">
                Mode:{' '}
                <strong>
                  {bankProvider?.configured ? 'live (API key)' : 'sandbox (no key)'}
                </strong>
                . Webhook URL for BankLink Pulses:
              </p>
              <code className="mt-2 block text-[10px] bg-neutral-50 border border-neutral-100 rounded-lg px-2 py-1.5 break-all">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/api/banking/webhooks/banklink`
                  : '/api/banking/webhooks/banklink'}
              </code>
              <p className="mt-2 text-neutral-500">
                Env: <code className="font-mono">BANKLINK_API_KEY</code>,{' '}
                <code className="font-mono">BANKLINK_WEBHOOK_SECRET</code> (optional).
              </p>
            </div>
            {selectedAccount && (
              <p className="text-xs text-neutral-500">
                Will prefer selected account #{selectedAccount} when mapping the feed.
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => setShowConnect(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-5 text-sm inline-flex items-center gap-2"
                disabled={connecting}
                onClick={() => void startBankConnect()}
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {bankProvider?.configured ? 'Connect with BankLink' : 'Connect sandbox FNB'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {showImport && (
        <Modal title="Import bank PDF or CSV" onClose={() => setShowImport(false)} wide>
          <div className="space-y-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Upload an <strong>FNB/RMB PDF statement</strong> — we extract text, convert to
              transactions (and optional CSV), then import. Text-based PDFs work best; scanned
              image-only PDFs may need OCR first. CSV is still supported.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  importForm.kind === 'pdf'
                    ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
                onClick={() =>
                  setImportForm((f) => ({ ...f, kind: 'pdf', csv: '', pdfBase64: f.pdfBase64 }))
                }
              >
                PDF
              </button>
              <button
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  importForm.kind === 'csv'
                    ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
                onClick={() => {
                  setImportFile(null);
                  setImportForm((f) => ({ ...f, kind: 'csv', pdfBase64: '' }));
                }}
              >
                CSV
              </button>
              {importForm.kind === 'csv' && (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1 hover:underline"
                  onClick={() => {
                    setImportForm((f) => ({
                      ...f,
                      kind: 'csv',
                      csv: UNIVERSAL_CSV_TEMPLATE,
                      format: 'universal',
                      filename: 'template.csv',
                      pdfBase64: '',
                    }));
                    setImportPreview(null);
                  }}
                >
                  <Download className="w-3.5 h-3.5" /> Load CSV template
                </button>
              )}
            </div>
            <Field label="Bank account" required>
              <select
                required
                value={importForm.bank_account_id}
                onChange={(e) =>
                  setImportForm({ ...importForm, bank_account_id: e.target.value })
                }
                className="input"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {importForm.kind === 'csv' && (
                <Field label="CSV bank format">
                  <select
                    value={importForm.format}
                    onChange={(e) => setImportForm({ ...importForm, format: e.target.value })}
                    className="input"
                  >
                    {BANK_CSV_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={importForm.kind === 'pdf' ? 'PDF file' : 'CSV file'}>
                <input
                  type="file"
                  accept={
                    importForm.kind === 'pdf'
                      ? 'application/pdf,.pdf'
                      : '.csv,text/csv,text/plain'
                  }
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                  className="text-xs w-full"
                />
                {importForm.filename && (
                  <div className="text-[11px] text-neutral-500 mt-1">{importForm.filename}</div>
                )}
              </Field>
            </div>
            {importForm.kind === 'csv' && (
              <Field label="CSV content">
                <textarea
                  value={importForm.csv}
                  onChange={(e) => {
                    setImportForm({
                      ...importForm,
                      kind: 'csv',
                      csv: e.target.value,
                      pdfBase64: '',
                    });
                    setImportPreview(null);
                  }}
                  className="input min-h-[140px] font-mono text-xs"
                  placeholder="Paste CSV here…"
                />
              </Field>
            )}
            {importForm.kind === 'pdf' && !importFile && !importForm.pdfBase64 && (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-xs text-neutral-500">
                Choose a .pdf bank statement (max ~12MB). Text-based FNB/RMB PDFs work best.
              </div>
            )}
            {importForm.kind === 'pdf' && (importFile || importForm.pdfBase64) && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-xs text-emerald-900">
                PDF ready
                {importFile
                  ? ` · ${importFile.name} (${Math.round(importFile.size / 1024)} KB)`
                  : ` (${Math.round((importForm.pdfBase64.length * 0.75) / 1024)} KB approx)`}
                . Run <strong>Preview</strong> to extract transactions, then <strong>Import</strong> to
                save them for allocation and management accounts.
              </div>
            )}
            {importPreview && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs space-y-1">
                {importPreview.error != null && (
                  <div className="text-red-700 font-semibold">
                    {String(importPreview.error)}
                  </div>
                )}
                <div>
                  Source: <strong>{String(importPreview.source || importForm.kind)}</strong>
                  {importPreview.pages != null ? ` · ${String(importPreview.pages)} pages` : ''}
                </div>
                {importPreview.wouldImport != null && (
                  <div>
                    Would import: <strong>{String(importPreview.wouldImport)}</strong> · Duplicates:{' '}
                    {String(importPreview.duplicates)} · Skipped: {String(importPreview.skipped)}
                  </div>
                )}
                {Array.isArray(importPreview.warnings) &&
                  (importPreview.warnings as string[]).map((w) => (
                    <div key={w} className="text-amber-800">
                      {w}
                    </div>
                  ))}
                {typeof importPreview.textPreview === 'string' &&
                  importPreview.textPreview &&
                  !importPreview.preview && (
                    <div className="mt-2 max-h-24 overflow-y-auto border-t border-neutral-200 pt-2 font-mono text-[10px] text-neutral-500 whitespace-pre-wrap">
                      Extracted text sample:{'\n'}
                      {String(importPreview.textPreview).slice(0, 400)}
                    </div>
                  )}
                {Array.isArray(importPreview.preview) &&
                  (importPreview.preview as Array<{ txn_date: string; description: string; amount: number }>).length >
                    0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto border-t border-neutral-200 pt-2 space-y-0.5">
                      {(
                        importPreview.preview as Array<{
                          txn_date: string;
                          description: string;
                          amount: number;
                        }>
                      )
                        .slice(0, 8)
                        .map((p, i) => (
                          <div key={i} className="flex justify-between gap-2 font-mono">
                            <span className="truncate">
                              {p.txn_date} {p.description}
                            </span>
                            <span className="tabular-nums flex-shrink-0">
                              {Number(p.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                {typeof importPreview.csv === 'string' && (
                  <button
                    type="button"
                    onClick={downloadCsvFromPreview}
                    className="mt-2 inline-flex items-center gap-1 text-[#00b4d8] font-semibold hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Download converted CSV
                  </button>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => void dryRunImport()}
                disabled={saving}
              >
                Preview
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void runImport()}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Allocate modal */}
      {showAllocate && (
        <Modal
          title={`Allocate · ${formatMoney(showAllocate.amount)}`}
          onClose={() => setShowAllocate(null)}
        >
          <form onSubmit={allocateOne} className="space-y-3">
            <p className="text-xs text-neutral-500">
              {showAllocate.txn_date} · {showAllocate.description}
              <br />
              {Number(showAllocate.amount) > 0
                ? 'Inflow → credit income (or other) account'
                : 'Outflow → debit expense (or other) account'}
            </p>
            <Field label="GL account" required>
              <select
                required
                value={allocForm.gl_account_id}
                onChange={(e) => setAllocForm({ ...allocForm, gl_account_id: e.target.value })}
                className="input"
              >
                <option value="">Select…</option>
                <optgroup label="Income / expense">
                  {incomeExpenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name} ({a.account_type})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  {plAccounts
                    .filter((a) => !['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Memo">
              <input
                value={allocForm.memo}
                onChange={(e) => setAllocForm({ ...allocForm, memo: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="VAT amount (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={allocForm.tax_amount}
                onChange={(e) => setAllocForm({ ...allocForm, tax_amount: e.target.value })}
                className="input"
                placeholder="0"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowAllocate(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Match invoice */}
      {showMatch && (
        <Modal
          title={`Match invoice · ${formatMoney(showMatch.amount)}`}
          onClose={() => setShowMatch(null)}
        >
          <form onSubmit={matchInvoice} className="space-y-3">
            <p className="text-xs text-neutral-500">
              {Number(showMatch.amount) > 0 ? 'Match to AR invoice' : 'Match to AP bill'}
            </p>
            <Field label="Invoice" required>
              <select
                required
                value={matchInvoiceId}
                onChange={(e) => setMatchInvoiceId(e.target.value)}
                className="input"
              >
                <option value="">Select open invoice…</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {inv.counterparty_name} · bal{' '}
                    {formatMoney(inv.balance_due)}
                  </option>
                ))}
              </select>
            </Field>
            {invoices.length === 0 && (
              <p className="text-xs text-amber-800">
                No open {Number(showMatch.amount) > 0 ? 'AR' : 'AP'} invoices. Create one first or
                allocate to GL instead.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowMatch(null)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !matchInvoiceId}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Match & pay'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e5e5;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
        .input:focus {
          outline: none;
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.12);
        }
      `}</style>
    </AccountingPage>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] hover:text-[#0077b6] text-neutral-500 transition-colors"
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className={`bg-white rounded-3xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
