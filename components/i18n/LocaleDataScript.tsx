import type { Dict } from '@/lib/i18n/dict';

export default function LocaleDataScript({ dict }: { dict: Dict }) {
  return (
    <script
      id="sa-locale-data"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dict) }}
    />
  );
}
