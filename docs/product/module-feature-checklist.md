# Module-by-module feature checklist

**Source of truth for steps:** `lib/chrome/module-nav.ts` (`MODULE_NAV`)  
**Sidebar order:** `lib/chrome/functional-nav.ts` (`FUNCTIONAL_MODULE_ORDER`)  
**Rule:** Functional nav is **1:1** with MODULE_NAV hubs — full step trees, no folding.  
**Audited:** 2026-08-09 · Phase 2/3  

Integrity: every `MODULE_NAV` id is in `FUNCTIONAL_MODULE_ORDER` (or emitted via fallback).  
Automated: `lib/chrome/module-nav-integrity.test.ts` (or script).

---

## Summary

| # | Module id | Sidebar label | Steps | Nav status |
|---|-----------|---------------|------:|------------|
| 1 | `home` | Control Tower | 0 | ✅ Full |
| 2 | `suppliers` | Suppliers | 10 | ✅ Full |
| 3 | `customers` | Customers | 10 | ✅ Full |
| 4 | `sales-portal` | Sales | 7 | ✅ Full |
| 5 | `operations` | Operations | 7 | ✅ Full |
| 6 | `manufacturing` | Make | 7 | ✅ Full |
| 7 | `distribution` | Ship | 6 | ✅ Full |
| 8 | `inventory` | Inventory | 7 | ✅ Full |
| 9 | `quality` | Quality | 7 | ✅ Full |
| 10 | `sheq` | SHEQ | 6 | ✅ Full |
| 11 | `projects` | Projects | 8 | ✅ Full |
| 12 | `accounting` | Finance | 14 | ✅ Full |
| 13 | `intelligence` | Intelligence | 7 | ✅ Full |
| 14 | `sustainability` | Impact | 8 | ✅ Full |
| 15 | `containers` | Containers | 13 | ✅ Full |
| 16 | `schools` | Schools | 57* | ✅ Full (role-filtered steps) |
| 17 | `health` | Health | 18* | ✅ Full (role-filtered steps) |
| 18 | `network` | Network | 5 | ✅ Full |
| 19 | `people` | People | 9 | ✅ Full |
| 20 | `my-business` | Administration | 15 | ✅ Full (+ Packaging) |
| 21 | `guide` | Guide | 12 | ✅ Full |

\* Schools/Health step counts include DBE / School / SP (or DoH / Facility / SP) groups; sidebar filters by programme role but does **not** drop the module tree definition.

**Total:** 21 modules · **233** process steps in `MODULE_NAV`.

**Additive (not MODULE_NAV):**  
- `industry_tools` — pack shortcuts into existing hubs  
- `multi_entity` — shortcut to Administration → Group  

---

## Control Tower (`home`)

| Step | Href | Status |
|------|------|--------|
| *(hub only)* | `/dashboard` | ✅ |

---

## Suppliers (`suppliers`) — SRM complete

| Step | Href | Status |
|------|------|--------|
| Overview | `/dashboard/suppliers` | ✅ |
| Source | `/dashboard/suppliers/discover` | ✅ |
| Connect | `/dashboard/suppliers/connect` | ✅ |
| Book | `/dashboard/suppliers/network` | ✅ |
| Invite | `/dashboard/suppliers/invites` | ✅ |
| Order | `/dashboard/suppliers/po` | ✅ |
| Escrow | `/dashboard/escrow` | ✅ |
| Score | `/dashboard/suppliers/performance` | ✅ |
| Rate | `/dashboard/suppliers/ratings` | ✅ |
| Report | `/dashboard/suppliers/report` | ✅ |

---

## Customers (`customers`) — CRM complete

| Step | Href | Status |
|------|------|--------|
| Overview | `/dashboard/customers` | ✅ |
| Source | `/dashboard/customers/leads` | ✅ |
| Book | `/dashboard/customers/profiles` | ✅ |
| Invite | `/dashboard/customers/invites` | ✅ |
| Quote | `/dashboard/customers/quotes` | ✅ |
| Order | `/dashboard/customers/orders` | ✅ |
| Invoice | `/dashboard/customers/invoices` | ✅ |
| Money | `/dashboard/customers/money` | ✅ |
| Rate | `/dashboard/customers/ratings` | ✅ |
| Report | `/dashboard/customers/report` | ✅ |

---

## Sales (`sales-portal`)

| Step | Href | Status |
|------|------|--------|
| Sell | `/sales` | ✅ |
| Pipeline | `/sales/pipeline` | ✅ |
| Quote | `/sales/quotes` | ✅ |
| Order | `/sales/orders` | ✅ |
| Invoice | `/sales/invoices` | ✅ |
| Earn | `/sales/earnings` | ✅ |
| Subscribe | `/sales/subscribe` | ✅ |

---

## Operations · Make · Ship

### Operations (`operations`)
Overview · Inbound · Store · Make · Outbound · Fulfill · Fix — all ✅  

### Make (`manufacturing`)
Overview · Plan · Explode · BOM · Run · Cells · Costs — all ✅  

### Ship (`distribution`)
Overview · Inbound · Outbound · Track · Carrier · Fleet — all ✅  

---

## Inventory (`inventory`)

Overview · Catalog · Stock · Receive · Move · Count · Lots — all ✅  

---

## Quality & SHEQ & Projects

### Quality — Overview · Inspect · HACCP · Trace · Recall · Export · SHEQ ✅  
### SHEQ — Overview · Incidents · Hazards · NCR · CAPA · Quality ✅  
### Projects — Overview · Portfolio · Programmes · DMAIC · SDG · Kanban · RIAD · Time ✅  

---

## Finance (`accounting`)

Overview · Chart · Journals · AR · AP · Payments · Bank · Budget · Manage · Reports · VAT · Assets · Entities · Settings — all ✅  

---

## Intelligence & Impact

### Intelligence — Overview · Pulse · Insights · Forecast · Score · Lab · Lead ✅  
### Impact (`sustainability`) — Overview · GHG · Resources · Targets · Certs · Actions · Material · Pack ✅  

---

## Containers (`containers`)

Command · Manage · Map · Impact · Feasibility · Add · Contractors · Resellers · Train · Metrics · Share · RIAD · Reports — all ✅  

---

## Schools (`schools`) — full NSNP (DBE / School / SP groups)

Includes (non-exhaustive of 57): Command, Desk, Join, Registry import, Catalogue, Menu, Recipes, Feeding calendar, Kitchen, Kitchen pack, Orders, Deliveries, Serve day, Claims, SP SLA, Visits, Monitoring, Prizes, SP workspace, etc. — **all defined in MODULE_NAV** ✅  
Sidebar filters by programme role; definitions never stripped by packaging.

---

## Health (`health`)

DoH desk · Join · Facilities · Catalogue · Orders · Kitchen · Nutrition · Deliver — defined ✅  

---

## Network · People · Administration · Guide

### Network — Graph · Open trade · Price · Market · Invite ✅  
### People — Overview · Directory · Org · Rate · Discipline · Payroll · Leave · Train · Onboard ✅  
### Administration (`my-business`) — Overview · Identity · Modules · **Packaging** · Team · Group · Trust · Verify · Billing · Docs · Settings · Ops · Sales · Referrals · Risks ✅  
### Guide — Start · Company · Network · Buy · Sell · Stock · Ops · Make · Ship · Assure · Money · Secure ✅  

---

## School simplified visibility

When entity = school, some **hubs** are hidden by default (Customers, Make, Sales portal, Containers, Projects) if not pack-enabled.  
**Schools module remains fully available** with kitchen, orders, serve day, claims, etc.

---

## Phase 3 notes

- Pack management must **add** modules, not remove existing step definitions.  
- SAM prompts should deep-link to the step hrefs above.  
- Pack dashboards are **templates/shortcuts**, not replacements for hubs.
