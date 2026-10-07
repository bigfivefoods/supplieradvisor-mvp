import type { Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict';
import { t } from '@/lib/i18n/dict';

export default function EnglishOnly({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  if (locale === 'en') return <>{children}</>;

  return (
    <div>
      <p className="mx-auto max-w-screen-2xl px-4 py-2 text-xs font-semibold text-slate-600 sm:px-6 lg:px-10">
        {t(dict, 'notice.englishOnlySection')}
      </p>
      <div lang="en" dir="ltr">
        {children}
      </div>
    </div>
  );
}
