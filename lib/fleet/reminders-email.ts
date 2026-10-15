/**
 * FleetAdvisor® reminder copy. Dates and names only. No identity numbers and no tokens.
 */
import { formatSastDate } from './format';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function reminderMessage(input: {
  kindLabel: string;
  subjectLabel: string;
  expiresOn: string;
  daysLeft: number;
  appOrigin: string;
}): { subject: string; text: string; html: string } {
  const when = formatSastDate(input.expiresOn);
  const timing = input.daysLeft > 0 ? `in ${input.daysLeft} day${input.daysLeft === 1 ? '' : 's'}` : input.daysLeft === 0 ? 'today' : `${Math.abs(input.daysLeft)} day${input.daysLeft === -1 ? '' : 's'} ago`;
  const line = `FleetAdvisor®: ${input.kindLabel.toLowerCase()} for ${input.subjectLabel} expires on ${when} (${timing}).`;
  const origin = input.appOrigin.replace(/\/$/, '');
  const centre = `${origin}/dashboard/fleetgraph/compliance`;
  const settings = `${origin}/dashboard/fleetgraph/settings`;
  const text = `${line}\n\nOpen the compliance centre: ${centre}\nReminder settings: ${settings}\n`;
  const html = `<p>${escapeHtml(line)}</p><p><a href="${escapeHtml(centre)}">Open the compliance centre</a></p><p><a href="${escapeHtml(settings)}">Reminder settings</a></p>`;
  return { subject: line, text, html };
}
