/**
 * Pure desk actions shared by the staff route and the signed-out sample.
 * Role checks happen here so the API and the preview cannot drift.
 */
import {
  mergeConstructiongraphStore,
  newConstructionId,
  type ConstructiongraphStore,
} from './constructiongraph';
import { reduceDiary, type DiaryEntry } from './diary-model';
import { baselineProgramme } from './programme-model';
import {
  capabilitiesFor,
  guardRoleMerge,
  type ConstructionRole,
} from './roles';
import { assertSafetyRows } from './safety-model';
import { decideVariation, type VariationDecision } from './variations-model';

export type ActionResult =
  | {
      ok: true;
      store: ConstructiongraphStore;
      events: Array<{ action: string; target: string }>;
    }
  | { ok: false; status: number; error: string; needsConfirm?: boolean };

const DELETE_COLLECTIONS = new Set(['diary', 'snags', 'safety', 'drawings', 'variations']);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function applyConstructionAction(
  store: ConstructiongraphStore,
  input: Record<string, unknown>,
  role: ConstructionRole
): ActionResult {
  const caps = capabilitiesFor(role);
  const action = String(input.action || 'merge');

  if (action === 'remove_sample') {
    if (role !== 'owner') return { ok: false, status: 403, error: 'Not available for your role' };
    const drop = <T extends { sample?: boolean }>(rows: T[]) => rows.filter((row) => !row.sample);
    return {
      ok: true,
      events: [{ action: 'remove_sample', target: 'sample' }],
      store: {
        ...store,
        clients: drop(store.clients),
        sites: drop(store.sites),
        quotes: drop(store.quotes),
        drawings: drop(store.drawings),
        boq: drop(store.boq),
        costs: drop(store.costs),
        subcontractors: drop(store.subcontractors),
        materials: drop(store.materials),
        plant: drop(store.plant),
        programme: drop(store.programme),
        safety: drop(store.safety),
        variations: drop(store.variations),
        certificates: drop(store.certificates),
        payments: drop(store.payments),
        snags: drop(store.snags),
        diary: drop(store.diary || []),
        portals: drop(store.portals),
      },
    };
  }

  if (action === 'delete_row') {
    const collection = String(input.collection || '');
    const id = String(input.id || '');
    if (!DELETE_COLLECTIONS.has(collection) || !id) {
      return { ok: false, status: 400, error: 'Cannot delete that row' };
    }
    const manager = role === 'owner' || role === 'site_manager';
    if (!manager) return { ok: false, status: 403, error: 'Not available for your role' };
    if (collection === 'variations') {
      const row = store.variations.find((item) => item.id === id);
      if (row && row.status !== 'draft') {
        return { ok: false, status: 400, error: 'Only a draft variation can be deleted' };
      }
    }
    if (collection === 'diary') {
      const row = (store.diary || []).find((item) => item.id === id);
      if (row?.signed_off_at) return { ok: false, status: 400, error: 'This day is signed off. Add an addendum.' };
    }
    const next = { ...store } as ConstructiongraphStore & Record<string, unknown>;
    const rows = Array.isArray(next[collection]) ? (next[collection] as Array<{ id?: string }>) : [];
    next[collection] = rows.filter((row) => row.id !== id);
    return {
      ok: true,
      store: next as ConstructiongraphStore,
      events: [{ action: 'delete_row', target: `${collection}:${id}` }],
    };
  }

  if (action === 'decide_variation') {
    if (!caps.canApproveVariations) {
      return { ok: false, status: 403, error: 'Not available for your role' };
    }
    const decision = String(input.decision || '') as VariationDecision;
    const result = decideVariation(store, {
      id: String(input.id || ''),
      decision,
      name: String(input.name || ''),
      note: String(input.note || ''),
      date: String(input.date || new Date().toISOString().slice(0, 10)),
    });
    if (!result.ok) return { ok: false, status: 400, error: result.error };
    return {
      ok: true,
      store: result.store,
      events: [{ action: 'decide_variation', target: String(input.id || '') }],
    };
  }

  if (action === 'baseline_programme') {
    if (!caps.canEditProgramme) return { ok: false, status: 403, error: 'Not available for your role' };
    const result = baselineProgramme(store, String(input.siteId || ''), Boolean(input.confirmRebaseline));
    if (!result.ok) {
      return { ok: false, status: 400, error: result.error, needsConfirm: result.needsConfirm };
    }
    return {
      ok: true,
      store: result.store,
      events: result.rebasing
        ? [{ action: 'rebaseline_programme', target: String(input.siteId || 'all') }]
        : [{ action: 'baseline_programme', target: String(input.siteId || 'all') }],
    };
  }

  if (action === 'merge') {
    const patch = asRecord(input.store);
    const guard = guardRoleMerge(role, patch);
    if (!guard.ok) return guard;
    if (Array.isArray(patch.safety)) {
      const checked = assertSafetyRows(patch.safety as ConstructiongraphStore['safety']);
      if (!checked.ok) return { ok: false, status: 400, error: checked.error };
    }
    let next = mergeConstructiongraphStore(store, patch as Partial<ConstructiongraphStore>);
    if (Array.isArray(patch.diary)) {
      const reduced = reduceDiary(store.diary, patch.diary as DiaryEntry[]);
      if (!reduced.ok) return { ok: false, status: 400, error: reduced.error };
      next = { ...next, diary: reduced.diary };
    }
    return { ok: true, store: next, events: [] };
  }

  return { ok: false, status: 400, error: 'Unknown action' };
}

export function newRowId(prefix: string): string {
  return newConstructionId(prefix);
}
