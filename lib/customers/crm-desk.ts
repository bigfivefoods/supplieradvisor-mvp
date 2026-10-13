import { stageProbability } from '@/lib/customers/types';

/** Johannesburg calendar day, matching the sales diary. */
export function crmToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
  }).format(now);
}

export function addCrmDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function crmDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

const CLOSED_LEAD = new Set(['converted', 'unqualified', 'recycled']);
const WON = new Set(['closed_won', 'won']);
const LOST = new Set(['closed_lost', 'lost']);

export type CrmDeskLead = {
  id: number;
  name?: string | null;
  company_name?: string | null;
  status?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
};

export type CrmDeskOpportunity = {
  id: number;
  name?: string | null;
  company_name?: string | null;
  stage?: string | null;
  status?: string | null;
  amount?: number | null;
  opportunity_size?: number | null;
  probability?: number | null;
  expected_close_date?: string | null;
  next_step?: string | null;
};

export type CrmDeskTask = {
  id: number;
  title?: string | null;
  kind?: string | null;
  status?: string | null;
  due_on?: string | null;
};

export type CrmDeskItem = {
  id: string;
  kind: 'follow_up' | 'close' | 'task';
  title: string;
  detail: string;
  when: string | null;
  overdue: boolean;
  href: string;
};

export function isOpenCrmLead(status?: string | null): boolean {
  return !CLOSED_LEAD.has(String(status || '').toLowerCase());
}

export function crmOpportunityStage(row: {
  stage?: string | null;
  status?: string | null;
}): string {
  return String(row.stage || row.status || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isOpenCrmOpportunity(row: {
  stage?: string | null;
  status?: string | null;
}): boolean {
  const stage = crmOpportunityStage(row);
  return !WON.has(stage) && !LOST.has(stage);
}

export function crmDeskCounts(
  leads: CrmDeskLead[],
  opportunities: CrmDeskOpportunity[],
  today: string
) {
  let pipelineValue = 0;
  let weightedPipeline = 0;
  let wonValue = 0;
  let wonCount = 0;
  let opportunitiesOpen = 0;

  for (const row of opportunities) {
    const amount = Number(row.amount ?? row.opportunity_size ?? 0);
    const stage = crmOpportunityStage(row);
    if (WON.has(stage)) {
      wonValue += amount;
      wonCount += 1;
      continue;
    }
    if (LOST.has(stage)) continue;
    opportunitiesOpen += 1;
    const probability =
      row.probability != null ? Number(row.probability) : stageProbability(stage);
    pipelineValue += amount;
    weightedPipeline += (amount * (Number.isFinite(probability) ? probability : 0)) / 100;
  }

  const overdueFollowups = leads.filter((lead) => {
    const when = crmDateOnly(lead.next_action_date);
    return Boolean(when && when < today && isOpenCrmLead(lead.status));
  }).length;

  return {
    overdueFollowups,
    pipelineValue,
    weightedPipeline: Math.round(weightedPipeline),
    wonValue,
    wonCount,
    opportunitiesOpen,
  };
}

/** Follow-ups, expected closes, and open diary tasks inside the horizon. Overdue first. */
export function buildCrmDesk(input: {
  leads: CrmDeskLead[];
  opportunities: CrmDeskOpportunity[];
  tasks: CrmDeskTask[];
  today: string;
  horizonDays?: number;
}): CrmDeskItem[] {
  const horizon = input.horizonDays ?? 14;
  const end = addCrmDays(input.today, horizon);
  const items: CrmDeskItem[] = [];

  for (const lead of input.leads) {
    const when = crmDateOnly(lead.next_action_date);
    if (!when || !isOpenCrmLead(lead.status) || when > end) continue;
    items.push({
      id: `lead-${lead.id}`,
      kind: 'follow_up',
      title: lead.name || lead.company_name || 'Lead',
      detail: lead.next_action || lead.company_name || 'Follow up',
      when,
      overdue: when < input.today,
      href: '/dashboard/customers/leads',
    });
  }

  for (const deal of input.opportunities) {
    const when = crmDateOnly(deal.expected_close_date);
    if (!when || !isOpenCrmOpportunity(deal) || when > end) continue;
    items.push({
      id: `opp-${deal.id}`,
      kind: 'close',
      title: deal.name || deal.company_name || 'Deal',
      detail: deal.next_step || deal.company_name || 'Expected close',
      when,
      overdue: when < input.today,
      href: '/dashboard/customers/leads?tab=pipeline',
    });
  }

  for (const task of input.tasks) {
    if (String(task.status || 'open') !== 'open') continue;
    const when = crmDateOnly(task.due_on);
    if (when && when > end) continue;
    items.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title || 'Diary task',
      detail: String(task.kind || 'task').replace(/_/g, ' '),
      when,
      overdue: Boolean(when && when < input.today),
      href: '/sales/tasks',
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.when || '9999-99-99').localeCompare(b.when || '9999-99-99');
  });
  return items.slice(0, 8);
}
