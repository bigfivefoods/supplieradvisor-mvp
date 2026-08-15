# Advisor Calendar & Customers — better than Outlook / Google

Generic calendars optimise for **meetings**. Advisor calendars optimise for **care delivery + revenue continuity**.

## Why SA calendar wins for advisors

| Capability | Outlook / Google | SupplierAdvisor |
|------------|------------------|-----------------|
| Day / week / month | Yes | Yes (`PracticeScheduleCalendar`) |
| Working hours / closed days | Partial | Practice hours + closed days |
| Clinician double-book guard | No | `findClinicianDiaryConflict` |
| Practice vs person diary | Limited | Explicit diary scope toggle |
| Utilisation & gaps | No | `advisor-calendar-intelligence` |
| Day briefing (risk, capacity) | No | `AdvisorCalendarBriefing` |
| Relationship / no-show on events | No | Enriched events + context card |
| Waitlist / packs / membership | No | Event context + client 360 |
| Print desk PDF | Limited | Brand print layout |
| Cross-module patients | No | Shared identity + consent shares |

## Customers (clients / patients) as the core

1. **Identity** — verified SA ID / passport, family members, POPIA consent  
2. **Relationship health** — care queue, journey, goals  
3. **Schedule** — upcoming, history, no-shows  
4. **Commercial** — membership, packs, claims (medical aid)  
5. **Record share** — patient portal + professional-to-professional consent  

Clicking a calendar block should open **ops context**, not a blank event form.

## Components

- `lib/services/advisor-calendar-intelligence.ts` — utilisation, gaps, briefing, risk enrich  
- `components/schedule/AdvisorCalendarBriefing.tsx` — side rail  
- `components/schedule/AdvisorEventContextCard.tsx` — selected event 360  
- Existing: `PracticeScheduleCalendar`, clinician diary conflicts, series/recurrence  

## Wire pattern (any advisor calendar page)

```tsx
const [day, setDay] = useState(today);
const [selected, setSelected] = useState<EnrichedScheduleEvent | null>(null);

<div className="grid lg:grid-cols-[1fr_280px] gap-4">
  <PracticeScheduleCalendar
    events={enriched}
    workingHours={hours}
    people={staff}
    onSelectDate={setDay}
    onSelectEvent={(e) => setSelected(e)}
    onCreateAt={...}
  />
  <div className="space-y-3">
    <AdvisorCalendarBriefing date={day} events={enriched} workingHours={hours} people={staff} />
    <AdvisorEventContextCard event={selected} />
  </div>
</div>
```

## Next

- Mount briefing + context on fitgraph / dental / physio / medical / psychiatry calendar pages  
- Drag-reschedule with conflict checks  
- SMS/WhatsApp reminder from event card  
- ICS feed per clinician for those who still want Outlook as a mirror (SA remains system of record)
