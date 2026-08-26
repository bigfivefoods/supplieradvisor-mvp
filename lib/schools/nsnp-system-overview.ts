/**
 * SchoolAdvisor system overview — why the OS exists, for four audiences.
 * Client-safe: no pdfkit. PDF builder is nsnp-system-overview-pdf.ts.
 */
import type { ProcessGuideOrientation } from '@/lib/schools/process-guide-links';

export type OverviewAudienceId = 'dbe' | 'school' | 'sp' | 'children';

export type OverviewBenefit = { title: string; body: string };

export type OverviewAudience = {
  id: OverviewAudienceId;
  title: string;
  kicker: string;
  promise: string;
  benefits: OverviewBenefit[];
};

export type NsnpSystemOverviewCopy = {
  headline: string;
  promise: string;
  closer: string;
  audiences: OverviewAudience[];
};

export const NSNP_SYSTEM_OVERVIEW: NsnpSystemOverviewCopy = {
  headline: 'One OS for the National School Nutrition Programme',
  promise:
    'SchoolAdvisor puts DBE, schools and service providers on the same verified record — so the meal that was authorised is the meal that reaches the child.',
  closer:
    'Catalogue, kitchen CoA, purchase order, photo POD, serve-day log and claim live on one trail. Paper packs and side WhatsApp chats are not the system of record.',
  audiences: [
    {
      id: 'dbe',
      title: 'DBE / PEU',
      kicker: 'Programme owner',
      promise: 'Set the rules once. See 5,000+ kitchens without chasing phones.',
      benefits: [
        {
          title: 'One mandate',
          body: 'Catalogue, menus, recipes and feeding calendar publish once. Every school and SP inherits the same rules.',
        },
        {
          title: 'Kitchen register',
          body: 'Valid CoA (R638) %, expired passports and red kitchens on one district slice — claim gates sit on the same numbers.',
        },
        {
          title: 'Evidence before pay',
          body: 'Claims open only after serve-day, three-way match, SP OTIFEF and kitchen safety. Queries drop because the pack is already on the OS.',
        },
        {
          title: 'Field on the same book',
          body: 'PEU visits (desk or phone PWA) write CoA / R638 outcomes onto the school record — not a separate spreadsheet.',
        },
        {
          title: 'Fair scoreboard',
          body: 'School prizes and SP preferred lists reward compliance. Non-compliant kitchens stay prize-blocked.',
        },
      ],
    },
    {
      id: 'school',
      title: 'Schools',
      kicker: 'Kitchen that serves',
      promise: 'Know what to cook, what to order, and when the claim is green.',
      benefits: [
        {
          title: 'Menu that cooks',
          body: 'DBE weekday recipes and portions sit on the kitchen board. No inventing the national menu.',
        },
        {
          title: 'Stock before empty',
          body: 'Cover vs menu demand flags shorts early. Raise a PO to a linked SP from the same desk.',
        },
        {
          title: 'Legal kitchen',
          body: 'CoA (R638) passport, PIC and monthly self-audit stay on file. Daily micro-log rides with serve day.',
        },
        {
          title: 'One-click claim',
          body: 'When match, SP SLA and kitchen safety are green, the claim pack is ready — not a paper chase.',
        },
        {
          title: 'Phone on the pot',
          body: 'Serve-day PWA works on kitchen phones, including offline drafts that sync when the signal returns.',
        },
      ],
    },
    {
      id: 'sp',
      title: 'Service providers',
      kicker: 'Supply that arrives',
      promise: 'See school POs immediately. Deliver approved items. Keep OTIFEF green.',
      benefits: [
        {
          title: 'Orders in one inbox',
          body: 'Linked schools raise POs against the live catalogue. You do not hunt for paper orders.',
        },
        {
          title: 'No rejected brands',
          body: 'Only approved products can be ordered or received. GRNs that are off-catalogue never close a claim.',
        },
        {
          title: 'Photo POD closes the loop',
          body: 'DN + photo proof of delivery + school GRN is the trail. OTIFEF is calculated from those rows.',
        },
        {
          title: 'Preferred is earned',
          body: 'On-time, in-full, error-free delivery is visible to DBE and schools. Preferred status follows the score.',
        },
        {
          title: 'In-app threads',
          body: 'Exceptions stay on the order thread with the school — not a side WhatsApp as the record.',
        },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      kicker: 'The reason the OS exists',
      promise: 'The authorised, safe meal is the meal that is served.',
      benefits: [
        {
          title: 'The meal arrives',
          body: 'Stock cover + linked SP OTIFEF means the kitchen is not empty on a feeding day.',
        },
        {
          title: 'Approved food',
          body: 'Only catalogue products reach the plate. Nutrition checks sit on the same menu dish.',
        },
        {
          title: 'Safe kitchen',
          body: 'Valid CoA, PIC and a daily R638 micro-log are required evidence — not a poster on the wall.',
        },
        {
          title: 'Every serve is logged',
          body: 'Present, served and waste are written on the day. Silent missed feeding has nowhere to hide.',
        },
        {
          title: 'Money to the plate',
          body: 'Claims pay against evidence. Leakage, off-catalogue spend and empty kitchens fail the gates.',
        },
      ],
    },
  ],
};

export function nsnpSystemOverviewPdfUrl(
  orientation: ProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/schools/system-overview/pdf?${q.toString()}`;
}

export function nsnpSystemOverviewFilename(
  orientation: ProcessGuideOrientation,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const orient = orientation === 'portrait' ? 'Portrait' : 'Landscape';
  return `SchoolAdvisor-System-Overview-${orient}-${day}.pdf`;
}
