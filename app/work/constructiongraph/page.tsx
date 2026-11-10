import ConstructiongraphWorkClient from '@/app/work/constructiongraph/constructiongraph-client';
import { fixturePublicHref } from '@/lib/preview/production-gate';

export default function WorkConstructionPage() {
  return (
    <ConstructiongraphWorkClient
      sampleOwnerHref={fixturePublicHref('/preview/constructiongraph/work?role=owner')}
      sampleWorkersHref={fixturePublicHref('/preview/constructiongraph/work?role=workers')}
    />
  );
}
