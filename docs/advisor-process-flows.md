# Advisor process flows

One shared diagram for an advisor Command page. The component draws whatever a typed data file describes. It does not fetch, it does not count rows, and it does not open a new route.

## Types

| Name | Role |
| --- | --- |
| `AdvisorFlowDef` | One module: phases, steps, roles, guardrails, roots |
| `FlowStepDef` | One step: status, target, who, sources |
| `FlowTarget` | A module path or an absolute in-app path |
| `FlowStatus` | `live`, `partial`, or `soon` |
| `AdvisorFlowView` | What the component renders after `resolveAdvisorFlow` |
| `FlowNodeView` | One step in that view: `id`, `n`, `title`, `desc`, `who`, `icon`, `state`, `linkHref`, `chips`, `mine`, `ariaLabel`, `secondary` |

`recovergraph` has its own diagram (`RecoverProcessFlow`) and is not in `ADVISOR_FLOWS`.

## How to add a module

1. Add `lib/advisors/process-flows/<module>.ts` exporting an `AdvisorFlowDef`. Read the screens before writing the copy. If a step is less built than it looks, mark it `partial` or `soon`.
2. Register it in `ADVISOR_FLOWS` inside `lib/advisors/process-flows/index.ts`. That map is the advisor registry. Core modules use `CORE_FLOWS` instead, as the next section describes.
3. Mount `<AdvisorProcessFlow module="..." />` once on that module's Command page. Pass the role, capability object, and `hrefBase` the page already has.
4. Add one row to `SHARED_MOUNTED` in `lib/advisors/process-flows/brief120-flow-mounts.test.ts`.

Ids that are not in that mount table and not in its `OWN` map are not registered. The test derives that remainder from `ADVISOR_OS_MODULE_IDS`, so there is no second list to edit.

Reuse an icon from `FLOW_ICON_NAMES`. A new picture is one name in that list and one entry in the `ICONS` map in `components/advisors/AdvisorProcessFlow.tsx`. TypeScript rejects a name with no icon. A module that reuses a name does not edit the component.

No new route, no sidebar edit, no migration. This doc does not keep a per-module id table.

## Status

- **live**: the screen does what the sentence says, and the step is a link.
- **partial**: the screen exists, and the note says what is missing. The step can still be a link.
- **soon**: there is no screen. `to` is null, the note is visible, and the step is not a link.

Downgrade beats overclaim. A step that cannot be shown from the code is not live.

## Links

A step is a link only when it has a target and the capability it needs is not false. Otherwise the card says "Not available to your role".

On a signed-out preview (`hrefBase` starts with `/preview/`):

- A module path is a link only when that path is in `previewPaths`. Other module paths say "Open in the signed-in app".
- An app path is plain text unless it has a `previewHref`.
- A known preview role is kept on the link as `?role=`, so the visitor stays in the role they chose. A `previewHref` that already sets `role` is left as written.

`soon` is never a link. Nothing uses `href="#"`.

Every flow starts closed for every role. Owner, manager, admin, an unknown role, and no role all start closed. The choice is not stored, and it does not change when the role loads or changes. The header always shows the title and the step and status summary. The toggle is a button. Tab reaches it, and Enter or Space opens and closes it. It sets `aria-expanded` and `aria-controls`. The panel those attributes name stays in the page when the flow is closed.

TradeAdvisor®, ApparelAdvisor® and ContainerAdvisor® have no module role on the Command page. The signed-in mount reads the company role already cached for the session. That role marks "You" and chooses which links stay available. It does not open the flow. ContainerAdvisor® does not mount until the company role is known, so a loading role is not drawn as a viewer. ApparelAdvisor® and ContainerAdvisor® have no signed-out preview, so their mounts are only on the signed-in Command page. The signed-out TradeAdvisor® preview does not call that hook. The module diagrams that keep their own components, and RecoverAdvisor®, start closed the same way.

Role `none` does not mount the diagram. FleetAdvisor® also leaves it unmounted while the company role has not been read, or while database setup is still pending, so that window is not drawn as a viewer.

HealthAdvisor® has no signed-out preview. Its Command page has three branches. Each branch mounts only the steps whose audiences include that branch, and only after the programme role has loaded. An unresolved role is not drawn as a clinic or hospital. The facilities, health map and management addresses are redirects, so the diagram links to the department desk, the schools map and the report.

## Colour and the registered mark

Cyan `#00b4d8` fill, navy `#0f172a` text on it, `#0077b6` for links and text on white. Never white text on cyan. The component does not use amber or stone utility classes, and it does not use a dark-mode variant.

Write the registered mark after the product name in prose (`TradeAdvisor®`). Do not put it in routes, ids, anchors, or test ids.

## Modules

The ids live in `ADVISOR_OS_MODULE_IDS`. Own diagrams, including RecoverAdvisor®, are the `OWN` map in the mounts test. Shared diagrams are the keys of `ADVISOR_FLOWS`. TradeAdvisor®, ConstructionAdvisor®, FleetAdvisor®, ApparelAdvisor®, ContainerAdvisor® and HealthAdvisor® are registered today.

## Left out on purpose

Live counts on a step, a PDF of the diagram, a chain of pills, a separate "who does what" grid, and any progress percentage. The optional `chips` prop can show a count later, only where an exact scoped query already exists. Nothing in the current registry passes chips.

## Core modules

Core flows use the same component and the same icon list, `FLOW_ICON_NAMES`. They are not in `ADVISOR_FLOWS`. Each one is a data file under `lib/advisors/process-flows/core/`, a line in `CORE_FLOWS`, and one `<CoreProcessFlow module="..." />` on the page. `ALL_FLOWS` is the lookup the component uses. `getAdvisorFlow` reads that lookup. A new core id in `MODULE_NAV` fails `brief121-core-mounts.test.ts` until it is mounted, skipped with a reason, or listed for a later change.

The flow stays closed until someone opens it. The header shows the title and the status line. The toggle is a button with `aria-expanded` and `aria-controls`, and the panel stays in the page.

Nothing mounts until the company role has finished loading and is a real role that can open the page. A sales contractor does not get a flow on a dashboard page. Sales uses the server allow-list (`sales_contractor`, `owner`, `admin`, `finance`, `sales`), not the client matrix. In a signed-out preview the mount waits for an effect, then uses the sample owner, which is the same role the preview membership stub uses. A step is a link there only when the fixture can open it. Other steps stay plain text and say they are not available here.

`coreFlowCaps` builds each view flag with `canView`, except `canUseSalesPortal`. The "who" chip on a step is the set of roles with write access on that step's resource. Gating of links follows the page guard, which is a client check. Server enforcement varies by API and is not implied by a flow.

| id | Decision |
| --- | --- |
| home | Mounted on Control Tower. The buy chain is not drawn anywhere else. The first-run checklist stays. |
| suppliers | Mounted. The journey checklist stays. |
| customers | Mounted below the path strip. The strip stays. |
| sales-portal | Mounted on the sales workspace. Links follow the server allow-list. |
| operations | Later. The hub already has numbered stage cards. A flow would add the hand-offs. |
| manufacturing | Later. The make screens are a real chain. |
| distribution | Later. Proof of delivery is only an event label today. |
| inventory | Later. Catalogue, stock, transfers and counts are a real chain. |
| quality | Later. Inspection, trace and the recall drill are a real chain. |
| sheq | Later. Incident to corrective action is a real loop. |
| projects | Later. Some screens depend on migrations and must not claim more than the page shows. |
| accounting | Later. Owner and finance only. Statements stay unaudited in the copy. |
| people | Later. Payroll records pay and does not pay staff from a bank. |
| sustainability | Later. Factors are estimates. The page guard uses the operations resource. |
| network | Later. Discover, invite, accept, price and trade is a short chain. |
| intelligence | Skipped. Read-only analysis. No hand-off and no job to do in order. |
| my-business | Skipped. Settings and identity. It already has its own checklist, and Control Tower has the first-run checklist. |
| platform | Skipped. Internal console for platform staff. Not a customer workflow. |
| guide | Skipped. The page is the training diagram. A flow on top would repeat it. |

Icons are reused from `FLOW_ICON_NAMES`. No new picture was added.

Control Tower, Suppliers, Customers and Sales are the flows in this change. Suppliers documents are partly live: the vault stores the file, and the contracts screen only opens that vault. The other steps in these four flows are live. None of them is launching soon.
