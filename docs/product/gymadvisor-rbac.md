# GymAdvisor® — RBAC, data model & invite flows

> Source of truth in code: `lib/fitness/fitgraph-rbac.ts`  
> Process guide roles: `lib/fitness/fitgraph-process-guide.ts` (`ROLE_CARDS`)

## Decision summary

| Actor | Pays for GymAdvisor? | Access level |
|-------|----------------------|--------------|
| **Owner** (gym company) | Yes — platform subscription | Full tenant admin |
| **Coach** (independent contractor) | No | Scoped: own classes, assigned clients, roster, feedback |
| **Member** | No (gym bills them off-platform) | Personal portal only |
| **Desk** (optional) | No | Floor ops when `has_front_desk` |

**Coaches do not get the same access as the owner.** They are contractors with revocable, scoped tools. Giving them owner rights creates POPIA / liability risk (full member export, rates, contracts, billing).

One SupplierAdvisor identity can hold different gym roles across companies (Owner @ A, Coach @ B, Member @ C).

---

## Permission matrix (screens)

| Screen / surface | Owner | Coach | Member | Desk | Notes |
|------------------|:-----:|:-----:|:------:|:----:|-------|
| Hub `/dashboard/fitgraph` | ✓ | — | — | partial | Today board for desk |
| Coaches | ✓ | — | — | — | Rates, contracts, specialty catalogue |
| Coach calendar | ✓ | ✓ own | — | ✓ | Coach write if `can_manage_classes` |
| Clients / members | ✓ | assigned + roster | — | ✓ | Coach never full book |
| Membership plans | ✓ | — | — | — | |
| Subscriptions | ✓ | — | — | — | |
| Class types | ✓ | — | — | — | |
| Calendar (main) | ✓ | own | — | ✓ | |
| Desk / bookings | ✓ | own classes | — | ✓ | |
| Check-ins | ✓ | — | self QR | ✓ | |
| Class feedback | ✓ | own sessions | submit | ✓ | |
| Messages | ✓ | ✓ | ✓ | ✓ | By platform user id when linked |
| Website & ops | ✓ | — | — | — | |
| Management report | ✓ | — | — | — | No export for coach |
| Coach portal (token) | — | ✓ | — | — | |
| Member portal (token) | — | — | ✓ | — | |

### Capability keys (API / UI gates)

See `FIT_PERMISSION_MATRIX` and `can()` in `lib/fitness/fitgraph-rbac.ts`.

**Owner-only highlights**

- Platform subscription & website settings  
- Coach rates, engagement history, PDF contracts  
- Membership plans, subscriptions, bulk export  
- Slice-and-dice reports  

**Coach highlights**

- Profile, specialties, public bio  
- Own sessions (create/edit/cancel/publish if `can_manage_classes`)  
- Roster plan vs actual, walk-in book, coach feedback  
- Health notes for clients on their roster / assigned private clients  
- Messaging with desk, peers, members  

**Member highlights**

- Public + own schedule, book / waitlist, family attendees  
- Self check-in QR, packs remaining, post-class feedback  
- In-app messages once `platform_user_id` is linked  

---

## Data model implications

### Current (MVP)

Gym book lives in **company profile metadata** under `fitgraph` (`FitgraphStore`):

- `coaches[]` — each may have `portal_token`, rates, contracts, `can_manage_classes`
- `clients[]` — `portal_token`, `invite_*`, `platform_user_id`, `coach_id`, membership fields
- sessions, bookings, check_ins, subscriptions, threads, settings, …

**Owner** = company admin (selected company + FitgraphRequired).  
**Coach / Member** = resolved via portal token or (preferred) `platform_user_id` link after invite accept.

### Recommended evolution

| Concept | Purpose |
|---------|---------|
| `FitGymRoleBinding` | `(company_id, platform_user_id, role, coach_id?, client_id?, status)` — multi-gym multi-role |
| `FitCoach.platform_user_id` | Same pattern as `FitClient.platform_user_id` |
| Optional `gym_roles` table | When metadata size / RLS needs grow beyond company JSON |

**Rules**

1. Data ownership stays with the **gym tenant** (company).  
2. Revoking a coach clears `portal_token` and/or closes engagement (`closeCoachEngagement`).  
3. Member leave → deactivate client; keep historical bookings.  
4. Coach sees clients via `clientsVisibleToCoach()` (assigned `coach_id` **or** on their session roster).  
5. Never expose owner-only fields (rates, full export, subscription admin) on coach/member payloads.

---

## Invite / accept flows

### Coach (independent contractor)

```
Owner creates FitCoach
    → issueCoachPortalToken(companyId)
    → email magic link (coach portal)
Recipient opens link → sign in / up (Privy)
    → bind platform_user_id on coach (or role binding)
    → status = active
Ongoing: portal token OR platform_user_id + company context
Revoke: clear token + optional end_date / close engagement
```

### Member

```
Owner or desk creates FitClient (+ plan, optional coach_id)
    → invite_token + issueClientPortalToken
    → email invite
Recipient accepts
    → FitClient.platform_user_id = SA user
    → invite_status = accepted, invite_accepted_at = now
Ongoing: member portal / PWA; messages by system user id
Family: book under parent client without separate SA accounts
```

### Existing SA user

If email already has a SupplierAdvisor account, accept still only grants the **gym-scoped** role — it does not elevate them to company admin.

### New user

Sign-up via Privy → accept invite → role binding active. They remain a normal B2C SA member elsewhere.

---

## Implementation checklist

- [x] Typed roles + permission matrix (`fitgraph-rbac.ts`)
- [x] `can()` with coach session / client scoping
- [x] `clientsVisibleToCoach()`
- [x] Screen access map for nav gating
- [x] API routes: call `can()` before mutations — `requireCompanyRoles(['owner'])` on all GymAdvisor desk routes (Brief 29)
- [x] UI: hide nav items via `FIT_SCREEN_ACCESS` — `fitgraph` module uses `gym_owner` resource (Brief 29)
- [x] Bind `platform_user_id` on coach accept (mirror client) — `link_platform_user` action on coach portal (Brief 29)
- [ ] Optional Supabase `gym_roles` when multi-gym analytics demand it

## POPIA / liability notes

- Coaches must not bulk-export the full member list.  
- Health / injury data: only on roster or assigned private clients.  
- Owner retains control of retention, freeze, and deletion.  
- Platform subscription is company-level; member gym fees stay off SA.
