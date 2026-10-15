/**
 * Programme maths for ConstructionAdvisor®: critical path, extension of
 * time, baselines. Planned dates are never rewritten by a variation.
 */
import { addDaysIso, type ConstructionProgrammeRow, type ConstructiongraphStore } from './constructiongraph';

export type ProgrammeRow = ConstructionProgrammeRow;

export function programmeDurationDays(row: ProgrammeRow): number {
  if (row.kind === 'milestone') return 0;
  const start = row.planned_start || row.start_date;
  const end = row.planned_end || row.end_date;
  if (!start || !end) return 1;
  const ms = Date.parse(`${end.slice(0, 10)}T00:00:00Z`) - Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 1;
  return Math.max(0, Math.round(ms / 86_400_000));
}

function knownDeps(row: ProgrammeRow, ids: Set<string>): string[] {
  const deps = Array.isArray(row.depends_on) ? row.depends_on : [];
  return deps.filter((id) => ids.has(id) && id !== row.id);
}

/** Longest finish-to-start path. Cycles are ignored. Missing ids are ignored. */
export function criticalPathIds(rows: ProgrammeRow[]): string[] {
  const list = rows.filter((row) => row && row.id);
  const ids = list.map((row) => row.id);
  const idSet = new Set(ids);
  const depsOf = new Map<string, string[]>();
  for (const row of list) depsOf.set(row.id, knownDeps(row, idSet));
  const dur = new Map(list.map((row) => [row.id, programmeDurationDays(row)]));

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of ids) {
    es.set(id, 0);
    ef.set(id, dur.get(id) || 0);
  }
  for (let pass = 0; pass < ids.length; pass += 1) {
    let changed = false;
    for (const id of ids) {
      let earliest = 0;
      for (const dep of depsOf.get(id) || []) earliest = Math.max(earliest, ef.get(dep) || 0);
      const finish = earliest + (dur.get(id) || 0);
      if (earliest !== es.get(id) || finish !== ef.get(id)) {
        es.set(id, earliest);
        ef.set(id, finish);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const projectEnd = ids.reduce((max, id) => Math.max(max, ef.get(id) || 0), 0);
  const successors = new Map<string, string[]>();
  for (const id of ids) {
    for (const dep of depsOf.get(id) || []) {
      const listForDep = successors.get(dep) || [];
      listForDep.push(id);
      successors.set(dep, listForDep);
    }
  }
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of ids) {
    lf.set(id, projectEnd);
    ls.set(id, projectEnd - (dur.get(id) || 0));
  }
  for (let pass = 0; pass < ids.length; pass += 1) {
    let changed = false;
    for (const id of ids) {
      const nexts = successors.get(id) || [];
      const latest = nexts.length
        ? Math.min(...nexts.map((next) => ls.get(next) ?? projectEnd))
        : projectEnd;
      const start = latest - (dur.get(id) || 0);
      if (latest !== lf.get(id) || start !== ls.get(id)) {
        lf.set(id, latest);
        ls.set(id, start);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return ids.filter((id) => (es.get(id) || 0) === (ls.get(id) || 0));
}

export function reviseEnd(row: ProgrammeRow, approvedExtraDays = 0) {
  const planEnd = (row.planned_end || row.end_date || '').slice(0, 10);
  const eotDays = Math.max(0, Number(row.eot_days) || 0) + Math.max(0, approvedExtraDays);
  return {
    planEnd,
    eotDays,
    revisedEnd: planEnd ? addDaysIso(planEnd, eotDays) : '',
    plannedEnd: row.planned_end || null,
  };
}

export function forecastEnd(row: ProgrammeRow, today: string): string {
  if (row.actual_end) return row.actual_end.slice(0, 10);
  const revised = reviseEnd(row).revisedEnd;
  const start = (row.actual_start || row.planned_start || row.start_date || '').slice(0, 10);
  const pct = Number(row.actual_pct ?? row.pct_complete ?? 0);
  if (start && pct > 0 && pct < 100) {
    const elapsed = Math.max(
      1,
      Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
      )
    );
    const forecastSpan = Math.round(elapsed / (pct / 100));
    return addDaysIso(start, Math.max(forecastSpan, 1));
  }
  return revised || (row.planned_end || '').slice(0, 10);
}

export function isDelayed(row: ProgrammeRow, today: string): boolean {
  if (row.status === 'delayed') return true;
  if (row.status === 'complete') return false;
  const revised = reviseEnd(row).revisedEnd;
  if (!revised) return false;
  if (row.actual_end && row.actual_end.slice(0, 10) > revised) return true;
  const pct = Number(row.actual_pct ?? row.pct_complete ?? 0);
  if (pct < 100 && today > revised) return true;
  return false;
}

export function applyEotDays(
  rows: ProgrammeRow[],
  rowIds: string[],
  days: number
): ProgrammeRow[] {
  const extra = Math.max(0, Number(days) || 0);
  if (!extra || !rowIds.length) return rows;
  const ids = new Set(rowIds);
  return rows.map((row) => {
    if (!ids.has(row.id)) return row;
    return { ...row, eot_days: (Number(row.eot_days) || 0) + extra };
  });
}

export function baselineProgramme(
  store: ConstructiongraphStore,
  siteId: string,
  confirmRebaseline: boolean
):
  | { ok: true; store: ConstructiongraphStore; changed: boolean; rebasing: boolean }
  | { ok: false; error: string; needsConfirm?: boolean } {
  const rows = store.programme.filter((row) => !siteId || row.site_id === siteId);
  if (!rows.length) return { ok: false, error: 'No programme rows on this project' };
  const already = rows.some((row) => row.baseline_start || row.baseline_end);
  if (already && !confirmRebaseline) {
    return { ok: false, error: 'Baseline already stored', needsConfirm: true };
  }
  const programme = store.programme.map((row) => {
    if (siteId && row.site_id !== siteId) return row;
    return {
      ...row,
      baseline_start: row.planned_start || row.start_date || row.baseline_start || null,
      baseline_end: row.planned_end || row.end_date || row.baseline_end || null,
    };
  });
  return {
    ok: true,
    store: { ...store, programme },
    changed: true,
    rebasing: already,
  };
}

export function shiftProgrammeRow(
  store: ConstructiongraphStore,
  rowId: string,
  days: number
): ConstructiongraphStore {
  const programme = store.programme.map((row) => {
    if (row.id !== rowId) return row;
    const start = row.planned_start || row.start_date;
    const end = row.planned_end || row.end_date;
    return {
      ...row,
      planned_start: start ? addDaysIso(start, days) : row.planned_start,
      planned_end: end ? addDaysIso(end, days) : row.planned_end,
    };
  });
  return { ...store, programme };
}
