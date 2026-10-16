import {
  availableCatalogues,
  type CatalogueEntry,
  type CatalogueGroup,
} from '@/lib/catalogues';
import { CatalogueCard } from '@/components/catalogues/CatalogueCard';

const GROUP_ORDER: readonly CatalogueGroup[] = [
  'platform',
  'supply-chain',
  'health-fitness',
  'retail-hire-public',
  'credit-recovery',
];

const GROUP_LABEL: Record<CatalogueGroup, string> = {
  platform: 'Platform',
  'supply-chain': 'Supply chain',
  'health-fitness': 'Health & fitness',
  'retail-hire-public': 'Retail, hire & public',
  'credit-recovery': 'Credit & recovery',
};

function CardList({ entries }: { entries: CatalogueEntry[] }) {
  if (!entries.length) return null;
  return (
    <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {entries.map((entry) => (
        <li key={entry.id} className="min-w-0">
          <CatalogueCard entry={entry} />
        </li>
      ))}
    </ul>
  );
}

export function CatalogueGrid({ groups = false }: { groups?: boolean }) {
  const available = availableCatalogues();
  const featured = available.find((entry) => entry.id === 'system' && entry.kind === 'system');
  const rest = featured ? available.filter((entry) => entry.id !== 'system') : available;

  const body = groups ? (
    <div className="space-y-12">
      {GROUP_ORDER.map((group) => {
        const entries = rest.filter((entry) => entry.group === group);
        if (!entries.length) return null;
        return (
          <section key={group} aria-labelledby={`catalogue-group-${group}`}>
            <h2
              id={`catalogue-group-${group}`}
              className="text-sm font-black uppercase tracking-[0.16em] text-slate-500"
            >
              {GROUP_LABEL[group]}
            </h2>
            <div className="mt-5">
              <CardList entries={entries} />
            </div>
          </section>
        );
      })}
    </div>
  ) : (
    <CardList entries={rest} />
  );

  return (
    <div className="min-w-0">
      {featured ? (
        <div className="mb-8">
          <CatalogueCard entry={featured} featured />
        </div>
      ) : null}
      {body}
    </div>
  );
}
