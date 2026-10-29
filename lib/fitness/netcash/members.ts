import {
  subscriptionChargeZar,
  type FitClient,
  type FitMembershipPlan,
  type FitSubscription,
} from '@/lib/fitness/fitgraph';
import { randsToCents } from '@/lib/fitness/netcash/money';
import type { BillableMember, BillablePlan } from '@/lib/fitness/netcash/types';

export function billableFromGym(input: {
  clients: FitClient[];
  plans: FitMembershipPlan[];
  subscriptions: FitSubscription[];
}): BillableMember[] {
  const plans = new Map(input.plans.map((plan) => [plan.id, plan]));
  const subs = new Map<string, FitSubscription[]>();
  for (const sub of input.subscriptions) {
    const list = subs.get(sub.client_id) || [];
    list.push(sub);
    subs.set(sub.client_id, list);
  }
  const members: BillableMember[] = [];
  for (const client of input.clients) {
    if (client.active === false) continue;
    const chosen = (subs.get(client.id) || []).filter((sub) => sub.status === 'active' || sub.status === 'trialing');
    const planIds = new Set<string>();
    const billablePlans: BillablePlan[] = [];
    for (const sub of chosen) {
      const plan = plans.get(sub.plan_id);
      if (!plan || plan.active === false || planIds.has(plan.id)) continue;
      planIds.add(plan.id);
      billablePlans.push(toPlan(plan, subscriptionChargeZar(sub, plan)));
    }
    if (!billablePlans.length && client.membership_plan_id) {
      const plan = plans.get(client.membership_plan_id);
      if (plan && plan.active !== false) billablePlans.push(toPlan(plan, plan.price_zar));
    }
    const discountPct = billablePlans.length && (client.family || []).length > 0
      ? Math.max(...input.plans.filter((plan) => planIds.has(plan.id)).map((plan) => Number(plan.sibling_discount_pct) || 0))
      : 0;
    members.push({
      memberId: client.id,
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      crmCustomerId: client.crm_customer_id ?? null,
      startDate: client.start_date || null,
      active: true,
      discountBps: Math.round(discountPct * 100),
      plans: billablePlans,
    });
  }
  return members;
}

function toPlan(plan: FitMembershipPlan, rands: number): BillablePlan {
  return {
    id: plan.id,
    name: plan.name,
    cents: randsToCents(rands),
    addon: plan.addon === true,
    billing: plan.billing,
  };
}
