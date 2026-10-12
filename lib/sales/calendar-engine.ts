import { getSupabaseServer } from '@/lib/supabase/server-client';
import { horizonScheduleEvents, taskScheduleEvent, type CrmTask, type DealHorizon } from '@/lib/sales/crm-tasks';
import { asCrmTask } from '@/lib/sales/diary-load';
import { appleClient } from '@/lib/sales/calendar-apple';
import { ensureGoogleCalendar, googleClient, refreshGoogleAccess } from '@/lib/sales/calendar-google';
import type { CalendarClient } from '@/lib/sales/calendar-google';
import { ensureOutlookCalendar, outlookClient, refreshOutlookAccess } from '@/lib/sales/calendar-microsoft';
import { openSecret, sealSecret } from '@/lib/sales/calendar-secrets';
import {
  addDays,
  contentStamp,
  partsInJohannesburg,
  reconcile,
  type BindingRow,
  type DiaryStamp,
  type SyncAction,
} from '@/lib/sales/calendar-sync';

const MISSING = /crm_calendar_links|crm_calendar_bindings|does not exist|schema cache/i;

type LinkRow = {
  id: number;
  profile_id: number;
  user_id: string;
  provider: string;
  account_email: string | null;
  calendar_id: string | null;
  secret_enc: string | null;
  status: string;
};

export type SyncResult = {
  tableReady: boolean;
  changed: boolean;
  results: { provider: string; pushed: number; pulled: number; error?: string }[];
};

function numId(value: string): number | null {
  const id = Number(value.split('-')[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function localStamps(tasks: (CrmTask & { updated_at?: string })[], deals: (DealHorizon & { updated_at?: string })[]): DiaryStamp[] {
  const today = partsInJohannesburg(new Date().toISOString())?.date || new Date().toISOString().slice(0, 10);
  const stamps: DiaryStamp[] = tasks.map((task) => {
    const event = taskScheduleEvent(task, today);
    return {
      key: event.id,
      title: event.title,
      date: event.date,
      start: event.start_time,
      end: event.end_time,
      notes: task.notes || '',
      status: task.status,
      updatedAt: task.updated_at || '',
    };
  });
  const byDeal = new Map(deals.map((deal) => [deal.id, deal]));
  for (const event of horizonScheduleEvents(deals)) {
    const dealId = event.opportunity_id || Number(event.id.split('-')[1]);
    stamps.push({
      key: event.id,
      title: event.title,
      date: event.date,
      start: event.start_time,
      end: event.end_time,
      notes: event.subtitle || '',
      status: 'open',
      updatedAt: byDeal.get(dealId)?.updated_at || '',
    });
  }
  return stamps;
}

async function saveBinding(
  linkId: number,
  profileId: number,
  localKey: string,
  remoteId: string,
  etag: string | null,
  snapshot: string
) {
  const supabase = getSupabaseServer();
  await supabase.from('crm_calendar_bindings').upsert(
    {
      link_id: linkId,
      profile_id: profileId,
      local_key: localKey,
      remote_id: remoteId,
      remote_etag: etag,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'link_id,local_key' }
  );
}

async function dropBinding(linkId: number, localKey: string) {
  await getSupabaseServer().from('crm_calendar_bindings').delete().eq('link_id', linkId).eq('local_key', localKey);
}

async function applyAction(
  action: SyncAction,
  link: LinkRow,
  client: CalendarClient
): Promise<'push' | 'pull' | 'none'> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  if (action.op === 'push') {
    const saved = await client.upsertEvent(action.item, action.remoteId);
    if (!saved.remoteId) {
      await dropBinding(link.id, action.item.key);
      return 'push';
    }
    await saveBinding(link.id, link.profile_id, action.item.key, saved.remoteId, saved.etag, contentStamp(action.item));
    return 'push';
  }
  if (action.op === 'delete-remote') {
    await client.deleteEvent(action.remoteId);
    await dropBinding(link.id, action.localKey);
    return 'push';
  }
  if (action.op === 'complete-local') {
    await finishLocal(link.profile_id, action.localKey, now);
    await dropBinding(link.id, action.localKey);
    return 'pull';
  }
  if (action.op === 'import') {
    const remote = action.remote;
    const inserted = await supabase
      .from('crm_tasks')
      .insert({
        profile_id: link.profile_id,
        title: remote.title.slice(0, 200),
        notes: remote.notes || null,
        kind: 'task',
        status: 'open',
        due_on: remote.date,
        due_time: remote.start || null,
        assignee_user_id: link.user_id,
        created_by: link.user_id,
        updated_at: now,
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || 'Could not save the calendar event');
    const key = `task-${inserted.data.id}`;
    const item: DiaryStamp = {
      key,
      title: remote.title.slice(0, 200),
      date: remote.date,
      start: remote.start || '09:00',
      end: remote.end || remote.start || '09:30',
      notes: remote.notes || '',
      status: 'open',
      updatedAt: now,
    };
    try {
      await client.upsertEvent(item, remote.remoteId);
    } catch {
      /* The binding still stops the next sync from importing it again. */
    }
    await saveBinding(link.id, link.profile_id, key, remote.remoteId, remote.etag, contentStamp(item));
    return 'pull';
  }
  const item = action.item;
  if ((item.key.startsWith('close-') || item.key.startsWith('next-')) && item.status === 'done') {
    await finishLocal(link.profile_id, item.key, now);
    await client.deleteEvent(action.remoteId);
    await dropBinding(link.id, item.key);
    return 'pull';
  }
  if (item.key.startsWith('task-')) {
    const id = numId(item.key);
    if (!id) return 'none';
    const saved = await supabase
      .from('crm_tasks')
      .update({
        title: item.title.slice(0, 200),
        notes: item.notes || null,
        due_on: item.date,
        due_time: item.start || null,
        status: item.status,
        completed_at: item.status === 'done' ? now : null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('profile_id', link.profile_id);
    if (saved.error) throw new Error(saved.error.message);
  } else if (item.key.startsWith('close-') || item.key.startsWith('next-')) {
    const id = numId(item.key);
    if (!id) return 'none';
    const nextStep = item.title.startsWith('Next · ') ? item.title.slice('Next · '.length).trim().slice(0, 500) : '';
    const patch = item.key.startsWith('close-')
      ? { expected_close_date: item.date, updated_at: now }
      : {
          next_step_date: item.date,
          ...(nextStep ? { next_step: nextStep } : {}),
          updated_at: now,
        };
    const saved = await supabase.from('opportunities').update(patch).eq('id', id).eq('profile_id', link.profile_id);
    if (saved.error) throw new Error(saved.error.message);
  }
  await saveBinding(link.id, link.profile_id, item.key, action.remoteId, action.etag, contentStamp(item));
  return 'pull';
}

async function finishLocal(profileId: number, key: string, now: string) {
  const supabase = getSupabaseServer();
  const id = numId(key);
  if (!id) return;
  if (key.startsWith('task-')) {
    await supabase
      .from('crm_tasks')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .eq('id', id)
      .eq('profile_id', profileId)
      .eq('status', 'open');
    return;
  }
  const patch = key.startsWith('close-')
    ? { expected_close_date: null, updated_at: now }
    : { next_step_date: null, updated_at: now };
  await supabase.from('opportunities').update(patch).eq('id', id).eq('profile_id', profileId);
}

async function clientFor(link: LinkRow): Promise<CalendarClient> {
  const secret = openSecret(String(link.secret_enc || ''));
  if (!secret) throw new Error('Reconnect this calendar');
  const supabase = getSupabaseServer();
  if (link.provider === 'google') {
    const access = await refreshGoogleAccess(secret);
    const calendarId = await ensureGoogleCalendar(access, link.calendar_id);
    if (calendarId !== link.calendar_id) {
      await supabase.from('crm_calendar_links').update({ calendar_id: calendarId }).eq('id', link.id);
    }
    return googleClient(access, calendarId, link.profile_id);
  }
  if (link.provider === 'outlook') {
    const refreshed = await refreshOutlookAccess(secret);
    if (refreshed.refreshToken && refreshed.refreshToken !== secret) {
      await supabase
        .from('crm_calendar_links')
        .update({ secret_enc: sealSecret(refreshed.refreshToken) })
        .eq('id', link.id);
    }
    const calendarId = await ensureOutlookCalendar(refreshed.accessToken, link.calendar_id);
    if (calendarId !== link.calendar_id) {
      await supabase.from('crm_calendar_links').update({ calendar_id: calendarId }).eq('id', link.id);
    }
    return outlookClient(refreshed.accessToken, calendarId);
  }
  const apple = JSON.parse(secret) as { appleId?: string; appPassword?: string };
  if (!apple.appleId || !apple.appPassword || !link.calendar_id) throw new Error('Reconnect Apple Calendar');
  return appleClient(apple.appleId, apple.appPassword, link.calendar_id, link.profile_id);
}

async function syncLink(link: LinkRow): Promise<{ pushed: number; pulled: number }> {
  const supabase = getSupabaseServer();
  const client = await clientFor(link);
  const today = partsInJohannesburg(new Date().toISOString())?.date || new Date().toISOString().slice(0, 10);
  const from = addDays(today, -60);
  const to = addDays(today, 400);
  const [taskHit, dealHit, bindingHit] = await Promise.all([
    supabase
      .from('crm_tasks')
      .select(
        'id, profile_id, customer_id, opportunity_id, title, notes, kind, status, due_on, due_time, assignee_user_id, assignee_name, created_by, completed_at, updated_at'
      )
      .eq('profile_id', link.profile_id)
      .order('due_on', { ascending: true })
      .limit(500),
    supabase
      .from('opportunities')
      .select(
        'id, name, customer_id, company_name, stage, expected_close_date, next_step, next_step_date, owner_name, sales_rep_user_id, updated_at'
      )
      .eq('profile_id', link.profile_id)
      .limit(500),
    supabase
      .from('crm_calendar_bindings')
      .select('local_key, remote_id, remote_etag, snapshot')
      .eq('link_id', link.id)
      .limit(1000),
  ]);
  if (taskHit.error) throw new Error(taskHit.error.message);
  const tasks = (taskHit.data || []).map((row) => ({
    ...asCrmTask(row as Record<string, unknown>),
    updated_at: row.updated_at ? String(row.updated_at) : '',
  }));
  const deals: (DealHorizon & { updated_at?: string })[] = (dealHit.data || []).map((row) => ({
    id: Number(row.id),
    name: String(row.name || 'Deal'),
    customer_id: row.customer_id ? Number(row.customer_id) : null,
    company_name: row.company_name ? String(row.company_name) : null,
    stage: row.stage ? String(row.stage) : null,
    expected_close_date: row.expected_close_date ? String(row.expected_close_date).slice(0, 10) : null,
    next_step: row.next_step ? String(row.next_step) : null,
    next_step_date: row.next_step_date ? String(row.next_step_date).slice(0, 10) : null,
    owner_name: row.owner_name ? String(row.owner_name) : null,
    sales_rep_user_id: row.sales_rep_user_id ? String(row.sales_rep_user_id) : null,
    updated_at: row.updated_at ? String(row.updated_at) : '',
  }));
  const bindings: BindingRow[] = (bindingHit.data || []).map((row) => ({
    localKey: String(row.local_key),
    remoteId: String(row.remote_id),
    snapshot: String(row.snapshot || ''),
    etag: row.remote_etag ? String(row.remote_etag) : null,
  }));
  const remote = await client.listEvents(from, to);
  const actions = reconcile({ local: localStamps(tasks, deals), remote, bindings, from, to }).slice(0, 200);
  let pushed = 0;
  let pulled = 0;
  for (const action of actions) {
    const kind = await applyAction(action, link, client);
    if (kind === 'push') pushed += 1;
    if (kind === 'pull') pulled += 1;
  }
  return { pushed, pulled };
}

export async function syncUserCalendars(companyId: number, userId: string): Promise<SyncResult> {
  const supabase = getSupabaseServer();
  const links = await supabase
    .from('crm_calendar_links')
    .select('id, profile_id, user_id, provider, account_email, calendar_id, secret_enc, status')
    .eq('profile_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active');
  if (links.error) {
    if (MISSING.test(links.error.message)) return { tableReady: false, changed: false, results: [] };
    throw new Error(links.error.message);
  }
  const results: SyncResult['results'] = [];
  let changed = false;
  for (const link of (links.data || []) as LinkRow[]) {
    try {
      const outcome = await syncLink(link);
      if (outcome.pulled > 0) changed = true;
      await supabase
        .from('crm_calendar_links')
        .update({ last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
        .eq('id', link.id);
      results.push({ provider: link.provider, ...outcome });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calendar sync failed';
      const auth = /reconnect|rejected|invalid_grant|unauthorized|401/i.test(message);
      await supabase
        .from('crm_calendar_links')
        .update({
          last_error: message.slice(0, 240),
          status: auth ? 'error' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);
      results.push({ provider: link.provider, pushed: 0, pulled: 0, error: message.slice(0, 240) });
    }
  }
  return { tableReady: true, changed, results };
}

export async function syncAllCalendars(): Promise<number> {
  const supabase = getSupabaseServer();
  const links = await supabase
    .from('crm_calendar_links')
    .select('profile_id, user_id')
    .eq('status', 'active')
    .limit(50);
  if (links.error) {
    if (MISSING.test(links.error.message)) return 0;
    throw new Error(links.error.message);
  }
  const seen = new Set<string>();
  let count = 0;
  for (const row of links.data || []) {
    const key = `${row.profile_id}:${row.user_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncUserCalendars(Number(row.profile_id), String(row.user_id));
    count += 1;
  }
  return count;
}
