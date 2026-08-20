/**
 * VUKA Fitness is still in testing — hold all notification mail for that gym.
 * Set EMAIL_ALLOW_VUKA=true to start sending.
 */
export const VUKA_EMAIL_SUPPRESS_COMPANY_ID = 110;

export function vukaNotificationEmailsAllowed(): boolean {
  const raw = String(process.env.EMAIL_ALLOW_VUKA || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function nameLooksLikeVuka(name: string): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  return /^vuka(\s+fitness)?$/i.test(n) || /^vuka\s*fitness/i.test(n);
}

function displayNameFromFrom(from: string): string {
  const raw = String(from || '').trim();
  const angled = raw.match(/^"?([^"<]+)"?\s*</);
  return (angled ? angled[1] : raw).trim();
}

export function isVukaNotificationSuppressed(input: {
  companyId?: number | string | null;
  companyName?: string | null;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  from?: string | null;
  tags?: Array<{ name?: string; value?: string }> | null;
}): boolean {
  if (vukaNotificationEmailsAllowed()) return false;
  const id = Number(input.companyId);
  if (Number.isFinite(id) && id === VUKA_EMAIL_SUPPRESS_COMPANY_ID) return true;
  for (const tag of input.tags || []) {
    if (String(tag.name || '') !== 'company_id') continue;
    if (Number(tag.value) === VUKA_EMAIL_SUPPRESS_COMPANY_ID) return true;
  }
  if (nameLooksLikeVuka(String(input.companyName || ''))) return true;
  if (nameLooksLikeVuka(displayNameFromFrom(String(input.from || '')))) {
    return true;
  }
  const blob = [
    input.subject,
    input.html,
    input.text,
    input.companyName,
  ]
    .map((s) => String(s || ''))
    .join('\n');
  return /\bvuka\s+fitness\b/i.test(blob);
}
