/**
 * Per-company JSON-LD (Organization / LocalBusiness + breadcrumbs).
 * Server component only.
 */
export default function CompanyJsonLd({
  graph,
}: {
  graph: Record<string, unknown>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
