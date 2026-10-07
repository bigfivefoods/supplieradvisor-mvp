import type { Dict } from '@/lib/i18n/dict';

export default function LocaleDataScript({ dict }: { dict: Dict }) {
  const serialized = JSON.stringify(dict).replace(/</g, '\\u003c');

  return (
    <script
      id="sa-locale-data"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
}
