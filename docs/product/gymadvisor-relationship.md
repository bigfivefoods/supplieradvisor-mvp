# GymAdvisor® — B2C Relationship Layer

> Goal: continuous, visible partnership between advisors (owners / coaches) and members.

## Implemented (shipped)

| Feature | Code |
|---------|------|
| Journey timeline + goals + health + ledger + stories/consent types | `lib/fitness/fitgraph-relationship.ts` |
| Care queue (at-risk / cooling) | `lib/fitness/fitgraph-coach-ops.ts` → `buildCareQueue` |
| Coach payout snapshot + performance | `fitgraph-coach-ops.ts` |
| Advisor relationship panel | `components/services/AdvisorRelationshipPanel.tsx` |
| Care queue UI + full page | `AdvisorCareQueue.tsx`, `/dashboard/fitgraph/care` |
| Coach ops (private clients, payout, perf) | `CoachOpsPanel.tsx` on coaches page |
| Client list health badges + profile panel | `clients/page.tsx` |
| Hub care module + queue | `fitgraph/page.tsx` |
| Member portal journey section | `MemberRelationshipSection` + public member API |
| Email coach invite | API `invite_coach` + coaches UI button |
| Persist relationship store | API `replace_relationship_store` |
| RBAC relationship actions | `fitgraph-rbac.ts` |

## Coach management (owner)

1. **Coaches** screen: create profile (email + ID required), specialties, rates, engagement dates.
2. **Issue portal** (link) or **Email invite** (Resend).
3. **Coach ops panel**: private-client assign/unassign, 14/30/90d performance, payout estimate.
4. **End tenure / rehire** with history; rates & contracts remain owner-only.
5. Coach access stays **scoped** (own classes, assigned + roster members).

## Member experience

- Portal shows connection health, active goals, recent journey, 90d value summary.
- Bookings, messages, packs, check-in QR unchanged.

## Next (optional)

- Soft per-coach permission flags beyond `can_manage_classes`
- Cross-module consent UI (physio ↔ gym)
- Push/email ritual prompts for quiet members
- Multi-gym role switcher in PWA chrome
