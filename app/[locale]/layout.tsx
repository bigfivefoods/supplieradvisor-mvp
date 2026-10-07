import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/lib/i18n/config';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== 'en').map((locale) => ({ locale }));
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale) || locale === 'en') {
    notFound();
  }

  return children;
}
