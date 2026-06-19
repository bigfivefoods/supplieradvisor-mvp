'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  BookOpen, 
  FileText, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Landmark, 
  CreditCard, 
  BarChart3, 
  Receipt, 
  Building2, 
  Settings,
  Globe
} from 'lucide-react';

export default function AccountingHub() {
  return (
    <ModuleHub
      title="Accounting"
      description="Full on-chain accounting system with Chart of Accounts, journals, payables, receivables, reconciliation, and impact reporting."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Chart of Accounts"
          description="Manage your flexible, multi-dimensional Chart of Accounts with project, entity, and impact tagging."
          href="/dashboard/accounting/chart-of-accounts"
          icon={BookOpen}
        />

        <HubCard
          title="Legal Entities"
          description="Manage legal entities, companies, branches, and multi-country operations."
          href="/dashboard/accounting/entities"
          icon={Globe}
        />

        <HubCard
          title="Journal Entries"
          description="Create and manage manual and automated journal entries with on-chain anchoring."
          href="/dashboard/accounting/journal-entries"
          icon={FileText}
        />

        <HubCard
          title="Accounts Payable"
          description="Manage supplier invoices, bills, credit notes, and payment runs."
          href="/dashboard/accounting/accounts-payable"
          icon={ArrowUpCircle}
        />

        <HubCard
          title="Accounts Receivable"
          description="Manage customer invoices, credit notes, and collections."
          href="/dashboard/accounting/accounts-receivable"
          icon={ArrowDownCircle}
        />

        <HubCard
          title="Bank & Reconciliation"
          description="Bank accounts, YOCO, crypto wallets, and automated reconciliation."
          href="/dashboard/accounting/bank-reconciliation"
          icon={Landmark}
        />

        <HubCard
          title="Payments"
          description="Payment runs, supplier payments, and multi-currency treasury."
          href="/dashboard/accounting/payments"
          icon={CreditCard}
        />

        <HubCard
          title="Reports & Analytics"
          description="Financial statements, P&L, Balance Sheet, Cash Flow, and Impact reports."
          href="/dashboard/accounting/reports"
          icon={BarChart3}
        />

        <HubCard
          title="Tax & Compliance"
          description="Tax configuration, VAT returns, and multi-country compliance."
          href="/dashboard/accounting/tax"
          icon={Receipt}
        />

        <HubCard
          title="Fixed Assets"
          description="Asset register, depreciation, and disposals."
          href="/dashboard/accounting/fixed-assets"
          icon={Building2}
        />

        <HubCard
          title="Settings"
          description="Accounting periods, currencies, approval workflows, and system configuration."
          href="/dashboard/accounting/settings"
          icon={Settings}
        />

      </div>
    </ModuleHub>
  );
}