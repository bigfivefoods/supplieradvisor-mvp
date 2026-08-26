export type ClinicMemberTabId =
  | 'mine'
  | 'open'
  | 'profile'
  | 'care'
  | 'share'
  | 'messages'
  | 'history';

export function isClinicYouTab(tab: ClinicMemberTabId) {
  return tab === 'profile' || tab === 'messages' || tab === 'history';
}

export function parseClinicMemberTab(
  raw: string | null | undefined
): ClinicMemberTabId | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t === 'book' || t === 'mine' || t === 'bookings') return 'mine';
  if (t === 'schedule' || t === 'open' || t === 'diary' || t === 'calendar') {
    return 'open';
  }
  if (t === 'you' || t === 'profile') return 'profile';
  if (
    t === 'care' ||
    t === 'rehab' ||
    t === 'scripts' ||
    t === 'records' ||
    t === 'chart' ||
    t === 'pets' ||
    t === 'animals' ||
    t === 'shop'
  ) {
    return 'care';
  }
  if (t === 'share') return 'share';
  if (t === 'messages' || t === 'inbox') return 'messages';
  if (t === 'history') return 'history';
  return null;
}

export function writeClinicTabToUrl(id: string) {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('tab', id);
    window.history.replaceState({}, '', `${u.pathname}${u.search}`);
  } catch {
    /* ignore */
  }
}
