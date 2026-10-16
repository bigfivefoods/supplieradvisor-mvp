import { catalogueById, catalogueFileUrl } from '@/lib/catalogues';
import {
  recordCatalogueDownload,
  shouldRecordCatalogueDownload,
} from '@/lib/catalogues/download-count';

type Ctx = { params: Promise<{ id: string }> };

/** Do not cache the redirect. A shared cache would skip the function and undercount. */
const NO_STORE = 'no-store';

export async function GET(incoming: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const entry = catalogueById(id);
  if (!entry || entry.status !== 'available' || !entry.file) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': NO_STORE,
      },
    });
  }
  if (
    shouldRecordCatalogueDownload({
      method: incoming.method,
      userAgent: incoming.headers.get('user-agent'),
    })
  ) {
    await recordCatalogueDownload(entry.id);
  }
  const location = catalogueFileUrl(entry, { download: true });
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': NO_STORE,
    },
  });
}
