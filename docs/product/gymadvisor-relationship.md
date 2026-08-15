# GymAdvisor® — B2C Relationship Layer

> Goal: move from operational connection (bookings, check-ins, basic messaging) to a continuous, visible partnership between advisors (owners / coaches) and customers (members).

Source of truth in code:
- `lib/fitness/fitgraph-relationship.ts` — types + pure helpers
- `lib/fitness/fitgraph.ts` — store fields + portal payloads
- `lib/fitness/fitgraph-rbac.ts` — relationship permission keys
- `components/services/AdvisorRelationshipPanel.tsx` — owner/coach UI surface

## Why this matters

Existing FitGraph already covers roster, feedback, injury notes, messaging, recalls and outcomes. Relationships that retain and refer need three deeper layers:

1. **Shared memory** — both sides see the same story of progress
2. **Mutual accountability** — goals and rituals owned by both
3. **Proactive care** — the platform surfaces risk and celebration moments so humans can act

## Feature set (priority order)

### 1. Shared Progress Timeline (Fit Journey)

A dual-sided chronological stream for a client ↔ coach (or gym) relationship.

**Event kinds**

| kind | Who can create | Visible to |
|------|----------------|------------|
| `session_attended` | system | both |
| `feedback` | system (from class feedback) | both |
| `coach_note` | coach / owner | both (or coach-private flag) |
| `member_log` | member | both |
| `goal_set` / `goal_progress` / `goal_achieved` | either | both |
| `milestone` | coach / owner / system | both |
| `photo` | member (consent) | both |
| `message_summary` | system | both |
| `story` | member | both + optional public |

**Rules**
- Private-client journeys are richer (more coach notes, PT sessions).
- Gym-floor members still get a timeline of attended classes + their own logs + goals.
- Soft-delete / archive; never hard-wipe history needed for disputes or reporting.

### 2. Relationship Health Signals

Computed score (0–100) and flags derived from existing data + new events:

- Attendance consistency (last 30 / 60 days)
- Feedback sentiment trajectory (feel + would_return)
- Days since last meaningful interaction (message, note, attended session)
- Goal velocity
- No-show / freeze risk

**Surfaces**
- Coach / owner: card on client profile + list badge (“Cooling”, “At risk”, “Strong”)
- Member: gentle “Your coach is thinking of you” or progress nudges (never shaming)
- Proactive care: suggested actions + message templates (“Check-in after 14 quiet days”)

### 3. Structured Goals + Ritual Check-ins

`FitGoal` objects owned jointly:

- Title, description, category (`physical` | `consistency` | `lifestyle` | `performance` | `other`)
- Target metric (optional numeric), unit, target date
- Status: `active` | `paused` | `achieved` | `abandoned`
- Review cadence (weekly / biweekly / monthly)
- Check-in log entries from member and coach comments

Member portal surfaces active goals + “log a check-in”. Coach dashboard shows overdue reviews.

### 4. Consent-based Cross-Advisor Visibility

Because SupplierAdvisor has DentalGraph, PhysioGraph, MedicalGraph, etc.:

`FitConsentShare`
- `from_module` / `to_module` (e.g. `physiograph` → `fitgraph`)
- `scope` (injury notes, clearances, medications summary, …)
- `granted_by` (platform_user_id of the member)
- `expires_at` (optional)
- Status active / revoked

When active, the receiving advisor sees a read-only card (“Physio clearance · valid until …”) without leaving GymAdvisor. POPIA: explicit, granular, revocable consent only.

### 5. Member Voice & Earned Reputation

`FitMemberStory`
- Before / after narrative, optional metrics, photo URLs (consent)
- Linked coach + gym
- Visibility: `private` | `coach_and_owner` | `gym_public` (website) | `platform`
- Moderation: owner can feature or unfeature

Stories feed coach reputation signals that are outcome-based rather than pure star ratings.

### 6. Fair Value Ledger

Computed (not stored) two-sided summary for a client:

**Member sees**
- Sessions attended, personal notes received, plan adjustments, time invested by coach (approx)

**Coach / owner sees**
- Hours delivered, outcomes, retention contribution, commission snapshot (if rate set)

Transparency reduces silent resentment and helps independent coaches justify rates.

## Data model (store extensions)

All live under company `metadata.fitgraph` (same pattern as sessions / feedback):

```ts
goals?: FitGoal[]
journey_events?: FitJourneyEvent[]
member_stories?: FitMemberStory[]
consent_shares?: FitConsentShare[]
```

See `lib/fitness/fitgraph-relationship.ts` for full TypeScript shapes.

## Permission notes

| Action | Owner | Coach | Member | Desk |
|--------|:-----:|:-----:|:------:|:----:|
| View journey (assigned / self) | ✓ | assigned | self | ✓ |
| Add coach note / milestone | ✓ | assigned | — | limited |
| Manage goals | ✓ | assigned | self | — |
| Submit story | — | — | ✓ | — |
| Feature story on website | ✓ | — | — | — |
| Grant / revoke consent share | — | — | ✓ (self) | — |
| View value ledger | ✓ | assigned | self | — |

Coach scoping continues to use `clientsVisibleToCoach()` / assigned `coach_id` + roster.

## Implementation status

- [x] Types + pure compute helpers (`fitgraph-relationship.ts`)
- [x] Store fields on `FitgraphStore`
- [x] RBAC action keys
- [x] Product design (this doc)
- [x] AdvisorRelationshipPanel (client profile surface)
- [x] Hub module entry + outcomes linkage
- [ ] Member portal UI for goals / journey / story capture (payload ready)
- [ ] Cross-module consent resolution API
- [ ] Automated proactive-care push / email templates
- [ ] Public website story feature toggle

## Suggested next engineering steps

1. Wire `computeRelationshipHealth` into the existing AdvisorRecallPanel / outcomes snapshot.
2. Member portal: Journey tab + “Log check-in” on goals.
3. Coach portal: “At risk” queue sorted by health score.
4. Consent share create/revoke endpoints under `/api/fitness/fitgraph` and parallel modules.
