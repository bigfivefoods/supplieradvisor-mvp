import Image from 'next/image';
import type { CatalogueEntry } from '@/lib/catalogues';
import { formatCatalogueSize } from '@/lib/catalogues';
import { CATALOGUE_FOCUS, CatalogueDownloadButton } from '@/components/catalogues/CatalogueDownloadButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUpdated(iso: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : iso;
}

export function CatalogueCard({
  entry,
  featured = false,
}: {
  entry: CatalogueEntry;
  featured?: boolean;
}) {
  if (entry.status !== 'available' || !entry.file || !entry.cover) return null;
  const size = formatCatalogueSize(entry.file.bytes);
  const meta = `PDF · ${entry.file.pages} pages · ${size} · Updated ${formatUpdated(entry.file.updated)}`;

  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:border-[#00b4d8] hover:shadow-md motion-reduce:transition-none dark:border-neutral-800 dark:bg-neutral-900 ${
        featured ? 'lg:flex-row' : ''
      }`}
    >
      <div className={`min-w-0 bg-slate-100 dark:bg-neutral-800 ${featured ? 'lg:w-1/2' : ''}`}>
        <Image
          src={entry.cover.src}
          alt={`${entry.name} catalogue cover page`}
          width={entry.cover.width}
          height={entry.cover.height}
          unoptimized
          loading="lazy"
          sizes="(min-width:1024px) 380px, (min-width:640px) 45vw, 92vw"
          className="h-auto w-full"
        />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col p-5 text-start sm:p-6 ${featured ? 'lg:justify-center' : ''}`}>
        <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{entry.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{entry.blurb}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{meta}</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
          <CatalogueDownloadButton id={entry.id} label="Download PDF" />
          {entry.industrySlug ? (
            <a
              href={`/industries/${entry.industrySlug}`}
              className={`inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6] underline underline-offset-4 dark:text-[#00b4d8] ${CATALOGUE_FOCUS}`}
            >
              See the industry page
            </a>
          ) : (
            <span
              className="invisible hidden min-h-11 items-center text-sm font-bold sm:inline-flex lg:hidden"
              aria-hidden="true"
            >
              See the industry page
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
