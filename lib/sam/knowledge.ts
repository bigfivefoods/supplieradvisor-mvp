/**
 * Compact platform knowledge injected into SAM's system prompt.
 * Built from the live guide curriculum + module navigation.
 */

import { GUIDE_SECTIONS, SYSTEM_OVERVIEW } from '@/lib/guide/curriculum';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  BILLING_TERMS,
} from '@/lib/billing/company-subscription';
import { SALES_SUBSCRIPTION_MONTHLY_ZAR } from '@/lib/sales-contractor/subscription';
import {
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_TOTAL_CAP_PCT,
  referralRatesSummary,
  referralSuggestedCopy,
} from '@/lib/billing/supply-chain-referral';

export function buildSamKnowledgeBrief(): string {
  const modules = MODULE_NAV.map((m) => {
    const steps = (m.steps || [])
      .slice(0, 8)
      .map((s) => `    - ${s.name}: ${s.href}`)
      .join('\n');
    return `- **${m.name}** (${m.href})\n${steps}`;
  }).join('\n');

  const guide = GUIDE_SECTIONS.map((s) => {
    const procs = s.processes
      .slice(0, 4)
      .map(
        (p) =>
          `  • ${p.name}${p.href ? ` → ${p.href}` : ''}: ${p.summary} Steps: ${p.steps.slice(0, 4).join(' → ')}`
      )
      .join('\n');
    return `### ${s.title} (/dashboard/guide/${s.slug})\n${s.purpose}\nWho: ${s.who.join(', ')}\n${procs}`;
  }).join('\n\n');

  const pricing = BILLING_TERMS.map(
    (t) =>
      `${t.label}: R${t.payZar}${t.discountPercent ? ` (save ${t.discountPercent}%)` : ''} · ${t.months} mo`
  ).join('; ');

  return `
# SupplierAdvisor® product facts (authoritative)

## What it is
SupplierAdvisor is a multi-tenant **supply-chain operating system** for B2B/B2G/B2C companies (South Africa first): company workspace, verified network trade, inventory, manufacturing, distribution, containers, CRM/sales, accounting, banking, quality/SHEQ, and intelligence.

## Mental model
${SYSTEM_OVERVIEW.subtitle}
Pillars: ${SYSTEM_OVERVIEW.pillars.map((p) => p.title).join(' · ')}
Master flow: ${SYSTEM_OVERVIEW.masterFlow.map((n) => n.label).join(' → ')}

## Auth & tenancy
- Sign-in: Privy (email / wallet).
- Always **select a company** (/dashboard/select-company) — data is scoped by company (profile_id).
- Roles: owner, admin, member, viewer, finance, operations, sales, sales_contractor.
- sales_contractor uses **/sales** portal only (not full ERP).

## Pricing (platform company plan)
- List: **R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month** after **${COMPANY_TRIAL_DAYS}-day free trial**.
- Prepaid terms: ${pricing}.
- Billing UI: /dashboard/my-business/billing
- Public pricing & referral: /#pricing and /#referral (same homepage)
- Sales contractor portal access is a separate fee (about R${SALES_SUBSCRIPTION_MONTHLY_ZAR}/mo term product) after agreement.

## Supply-chain referral (company-to-company, NOT sales-rep MLM)
- When companies invite others via referral link (?ref=code), subscription payments credit up the chain.
- Suggested split: ${referralRatesSummary()} of the **paid subscription amount**.
- ${referralSuggestedCopy()}
- Payout workflow: pending → approved → payout_requested (company requests) → paid (finance marks with bank/ref). Can void before paid.
- Manage under /dashboard/my-business/billing (referral panel) or /api/business/referrals.
- Sales contractor product commission remains **personal sales only** (not multi-level recruiting pay) — company Sales program sets 4%/5%/6% stepped bands typically.

## Sales contractor program
- Configure under /dashboard/my-business/sales-program (legal, commission tiers, KPIs).
- Contractors sign at /sales/agreement, subscribe at /sales/subscribe, sell via /sales pipeline.

## Module map (live routes)
${modules}

## How-to guide (full training)
Open /dashboard/guide and module pages under /dashboard/guide/[slug].
${guide}

## Helpful tips for SAM answers
- Prefer deep links to real screens (e.g. /dashboard/inventory/products).
- Remind users to pick the right company workspace.
- For money: Quotes → Orders → Invoices → Bank allocate → Journals.
- For goods: Receive → Stock → Produce → Ship / containers.
- For trust: Quality holds, HACCP, OTIFEF, RIAD logs.
- If unsure of a brand-new feature, say so and point to /dashboard/guide or the relevant module settings.
`.trim();
}

export const SAM_NAME = 'SAM';
export const SAM_FULL_NAME = 'Supplier Advisor Messenger';
export const SAM_MODEL = process.env.SAM_MODEL || process.env.XAI_MODEL || 'grok-4.5';
