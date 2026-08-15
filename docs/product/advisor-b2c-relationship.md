# Cross-Advisor B2C Relationship & Patient Record Sharing

Applies to **DentalAdvisor®, PhysioAdvisor®, MedicalAdvisor®, PsychiatryAdvisor®**, and **GymAdvisor®**.

## Goals

1. **Strong B2C bond** — same care-queue + relationship health pattern as GymAdvisor, driven by visits, no-shows, open plans, and recalls.
2. **Patient visibility** — safe summary of their own record on the member/patient portal (allergies, goals, scripts, plan) when `share_medical` allows.
3. **Professional-to-professional share** — e.g. dentist → physio, GP → psychiatrist — only after **explicit patient consent** (pending → active → revocable).
4. **POPIA** — least privilege scopes; full chart stays practice-side unless `full_chart` is deliberately granted.

## Modules

| Piece | Path |
|-------|------|
| Shared health + care queue + grant types | `lib/services/advisor-b2c-relationship.ts` |
| Scope-filtered record payloads | `lib/services/advisor-patient-record-share.ts` |
| Existing network share (company↔company, member wallet) | `lib/b2c/profile-shares.ts` |
| Safe medical summary builder | `lib/clinic/medical-share.ts` |
| Practice UI | `components/services/PatientRecordSharePanel.tsx` |
| Gym-specific depth | `lib/fitness/fitgraph-relationship.ts` + care queue |

## Clinical scopes

- `summary` — allergies, conditions, goals, injury status (patient default)
- `treatment_plan` — care / treatment plan
- `scripts` — active prescriptions
- `clinical_notes` — visit notes (professional only by default)
- `imaging_docs` — document metadata
- `full_chart` — restricted; never default

## Flow: share with another professional

1. Practices are **connected** in SupplierAdvisor network.
2. Desk opens patient → **Patient record sharing** → select peer + scopes → **Create share request** (`status: pending`).
3. Patient sees request in **SA Member** / portal → accepts or declines.
4. On accept, receiving practice may call `buildProfessionalFacingRecord` — only consented scopes.
5. Patient or originating practice can **revoke** anytime.

## Flow: patient portal

- `buildPatientFacingRecord(patient)` uses default scopes or active patient grants.
- Honours `share_medical: false` as hard stop.

## Care queue (all medical advisors)

```ts
import {
  engagementFromClinicStore,
  buildClinicCareQueue,
} from '@/lib/services/advisor-b2c-relationship';

const queue = buildClinicCareQueue(engagementFromClinicStore(store));
```

Wire on dental/physio/medical/psychiatry hubs the same way as FitGraph care queue.

## Staff / clinician model

Same principle as coaches: **owner/practice pays and owns the tenant**; clinicians are scoped (own diary + assigned patients). Use existing staff engagement + portal tokens; do not give clinicians export of the full patient book without assignment.

## Next wiring (per module)

- Persist `patient_record_grants[]` on each `*graph` store metadata.
- Mount `PatientRecordSharePanel` on patient profile pages.
- Attach care queue to each advisor hub.
- Member app: accept/decline professional share requests (alongside existing profile_shares).
