import TradegraphWorkClient from '@/app/work/tradegraph/tradegraph-client';
import { fixturePublicHref } from '@/lib/preview/production-gate';

export default function WorkTradePage() {
  return (
    <TradegraphWorkClient sampleOwnerHref={fixturePublicHref('/preview/tradegraph/work?role=owner')} />
  );
}
