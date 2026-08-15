# Advisor Calendar & Customers — better than Outlook / Google

## Shipped

### Intelligence
- `lib/services/advisor-calendar-intelligence.ts` — utilisation, gaps, day briefing, risk enrich
- `components/schedule/AdvisorCalendarBriefing.tsx`
- `components/schedule/AdvisorEventContextCard.tsx` — ICS one-shot, email/WhatsApp reminder, ±15m / ±1 day reschedule
- `components/schedule/AdvisorCalendarSidebar.tsx` — briefing + context + diary ICS link

### System of record vs mirror
- `lib/schedule/advisor-ics.ts` + `GET /api/schedule/ics` — full diary feed for Outlook/Google **mirror**
- SA remains source of truth; ICS is export only

### Reminders
- `POST /api/schedule/remind` — email (Resend) or WhatsApp deep link (`wa.me`)

### Page mounts
Calendar pages for **fitgraph, dentalgraph, physiograph, medicalgraph, psychiatrygraph** use:
1. Grid layout with sticky intelligence rail
2. `selectedEvent` state on click
3. `onReschedule` → upsert session/appointment
4. ICS feed download link

## Wire pattern

```tsx
<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
  <div className="min-w-0">
    <PracticeScheduleCalendar ... onSelectEvent={(ev) => setSelectedEvent(ev)} />
  </div>
  <AdvisorCalendarSidebar
    date={day}
    events={events}
    workingHours={workingHours}
    people={people}
    selected={selectedEvent}
    companyId={companyId}
    module="dentalgraph"
    onReschedule={async ({ id, date, start_time }) => {
      await post({ entity: 'appointments', action: 'upsert', record: { id, date, start_time } });
    }}
  />
</div>
```

## Why not Outlook/Google as primary

| Need | Generic calendar | SA |
|------|------------------|-----|
| Clinician double-book guard | No | Yes |
| Utilisation / gaps / care risk | No | Day briefing |
| Membership, packs, relationship | No | Event context |
| Patient consent shares | No | Record share layer |
| Remind from the block | Awkward | Email + WhatsApp |
| ICS for staff who insist | Native | Mirror feed |

## Optional later
- Drag-drop on the grid (quick ±15m covers most desk moves today)
- Conflict toast when reschedule hits `findClinicianDiaryConflict`
- Tokenized public ICS URLs for staff without dashboard login
