/**
 * Deterministic "AI assist" drafts for Advisor desk — no external LLM required.
 * Swap for SpaceXAI / LLM later while keeping the same interface.
 */

export function draftRecallMessage(opts: {
  personName: string;
  brand: string;
  daysSince?: number | null;
  serviceHint?: string;
}): { subject: string; body: string; whatsapp: string } {
  const when =
    opts.daysSince != null
      ? `It's been about ${opts.daysSince} days since your last visit`
      : `We'd love to see you again`;
  const svc = opts.serviceHint || 'check-up';
  const subject = `Time for your ${svc} · ${opts.brand}`;
  const body = `Hi ${opts.personName},\n\n${when}. Book your next ${svc} with ${opts.brand} when you're ready — reply to this email or use your member portal.\n\n— ${opts.brand}`;
  const whatsapp = `Hi ${opts.personName}, ${when.toLowerCase()}. Ready to book your next ${svc} at ${opts.brand}?`;
  return { subject, body, whatsapp };
}

export function draftClassPlan(opts: {
  className: string;
  durationMin?: number;
  focus?: string;
  level?: string;
}): { title: string; plan: string } {
  const dur = opts.durationMin || 45;
  const focus = opts.focus || 'full body';
  const level = opts.level || 'mixed';
  const warm = Math.max(5, Math.round(dur * 0.15));
  const main = Math.max(15, Math.round(dur * 0.6));
  const cool = Math.max(5, dur - warm - main);
  const plan = [
    `Class: ${opts.className} (${dur} min · ${level})`,
    ``,
    `1. Warm-up (${warm} min) — mobility + activation for ${focus}`,
    `2. Main block (${main} min) — progressive ${focus} work, 3–4 stations or rounds`,
    `3. Finisher (optional 3–5 min) — density or core`,
    `4. Cool-down (${cool} min) — stretch + breathing`,
    ``,
    `Coaching cues: scale load, watch form, call out time checks every 5 min.`,
  ].join('\n');
  return { title: `${opts.className} session plan`, plan };
}

export function draftVisitSummary(opts: {
  personName: string;
  serviceName?: string;
  painScore?: number | null;
  functionScore?: number | null;
  notes?: string;
}): string {
  const parts = [
    `Visit summary — ${opts.personName}`,
    opts.serviceName ? `Service: ${opts.serviceName}` : null,
    opts.painScore != null ? `Pain (0–10): ${opts.painScore}` : null,
    opts.functionScore != null
      ? `Function (0–10): ${opts.functionScore}`
      : null,
    opts.notes ? `Notes: ${opts.notes}` : 'Notes: (add clinical detail)',
    `Plan: continue care plan; rebook as indicated.`,
  ].filter(Boolean);
  return parts.join('\n');
}

export function draftMarketplaceBlurb(opts: {
  brand: string;
  moduleLabel: string;
  city?: string;
  specialties?: string[];
}): string {
  const specs = (opts.specialties || []).slice(0, 4).join(', ');
  return `${opts.brand} — ${opts.moduleLabel}${
    opts.city ? ` in ${opts.city}` : ''
  }.${specs ? ` Specialties: ${specs}.` : ''} Book online via SupplierAdvisor.`;
}
