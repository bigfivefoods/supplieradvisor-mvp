'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { isTranslatedPath, localizedPath } from '@/lib/i18n/config';
import FooterFoundingForm from '@/components/marketing/FooterFoundingForm';
import FooterYear from '@/components/marketing/FooterYear';
import {
  FOOTER_CONTACT,
  FOOTER_EXPLORE_GROUPS,
  FOOTER_INDUSTRY_GROUPS,
  FOOTER_LEGAL_LINKS,
  FOOTER_RESOURCE_GROUPS,
  FOOTER_SOCIALS,
  type FooterLink,
  type FooterLinkGroup,
} from '@/lib/marketing/site-footer';

const sectionTitleClass = 'text-sm font-semibold text-slate-900 mb-4 dark:text-white';
const groupLabelClass = 'text-xs font-medium text-[#737373] mb-2 dark:text-slate-400';
const linkClass =
  'block min-h-6 text-sm text-[#6b7280] hover:text-[#0077b6] transition-colors leading-snug dark:text-slate-300 dark:hover:text-white';

const LINK_KEY_BY_HREF: Record<string, string> = {
  '/#video': 'nav.product',
  '/#member-app': 'nav.member',
  '/#why-join': 'nav.why',
  '/#modules': 'nav.modules',
  '/#packaging': 'nav.howFits',
  '/#compare': 'footer.link.compare',
  '/#security': 'footer.link.security',
  '/pricing': 'nav.pricing',
  '/#roi': 'footer.link.roi',
  '/industries': 'nav.industries',
  '/demo': 'footer.link.demo',
  '/join': 'footer.link.joinBusiness',
  '/marketplace': 'footer.link.marketplace',
  '/marketplace/advisors': 'footer.link.findAdvisor',
  '/verification-sla': 'footer.link.cipcSla',
  '/me': 'footer.link.memberSignup',
  '/install': 'footer.link.installApp',
  '/login': 'nav.logIn',
  '/onboarding?lane=b2b': 'nav.startTrial',
  '/privacy': 'footer.link.privacy',
  '/terms': 'footer.link.terms',
  '/cancellation-refund': 'footer.link.cancellation',
};

const GROUP_LABEL_KEY_BY_LABEL: Record<string, string> = {
  Product: 'footer.group.product',
  'Get started': 'footer.group.getStarted',
  Network: 'footer.group.network',
  Trust: 'footer.group.trust',
  Apps: 'footer.group.apps',
};

function FooterNav({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className={sectionTitleClass}>{title}</div>
      {children}
    </div>
  );
}

function FooterLinkItem({ href, label }: FooterLink) {
  const { locale, t } = useLocaleDictionary();
  const localizedLabel = LINK_KEY_BY_HREF[href] ? t(LINK_KEY_BY_HREF[href]) : label;

  let nextHref = href;
  let hrefLang: string | undefined;
  if (href.startsWith('/#')) {
    const hash = href.replace('/#', '');
    nextHref = `${localizedPath(locale, '/')}#${hash}`;
    hrefLang = locale;
  } else if (href.startsWith('/')) {
    nextHref = isTranslatedPath(href) ? localizedPath(locale, href) : href;
    hrefLang = isTranslatedPath(href) ? locale : 'en';
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a
        href={href}
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="whitespace-nowrap">{localizedLabel}</span>
      </a>
    );
  }

  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} className={linkClass}>
        <span className="whitespace-nowrap">{localizedLabel}</span>
      </a>
    );
  }

  return (
    <Link href={nextHref} hrefLang={hrefLang} prefetch={false} className={linkClass}>
      <span className="whitespace-nowrap">{localizedLabel}</span>
    </Link>
  );
}

function SimpleNav({ links }: { links: FooterLink[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {links.map((link) => (
        <FooterLinkItem key={`${link.href}:${link.label}`} {...link} />
      ))}
    </div>
  );
}

function GroupedNav({
  groups,
  ariaLabel,
  lang,
  resolveLabel,
}: {
  groups: FooterLinkGroup[];
  ariaLabel: string;
  lang?: string;
  resolveLabel?: (label: string) => string;
}) {
  return (
    <nav className="space-y-4 sm:space-y-5" aria-label={ariaLabel} lang={lang}>
      {groups.map((group) => (
        <div key={group.label}>
          <div className={groupLabelClass}>{resolveLabel ? resolveLabel(group.label) : group.label}</div>
          <ul className="space-y-1.5 sm:space-y-2">
            {group.links.map((link) => (
              <li key={`${link.href}:${link.label}`}>
                <FooterLinkItem {...link} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function SiteFooter() {
  const { t } = useLocaleDictionary();
  const localizedGroupTitle = (label: string) => {
    const key = GROUP_LABEL_KEY_BY_LABEL[label];
    return key ? t(key) : label;
  };
  const localizedLabel = (link: FooterLink) => {
    const key = LINK_KEY_BY_HREF[link.href];
    return key ? t(key) : link.label;
  };
  return (
    <footer className="bg-[#f3f4f6] text-black dark:bg-neutral-950">
      <div className="max-w-7xl 2xl:max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="rounded-[28px] border border-black/[0.06] bg-white px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900 dark:border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            <div className="lg:col-span-4 min-w-0">
              <Link
                href="/"
                prefetch={false}
                aria-label="SupplierAdvisor home"
                className="inline-flex items-center gap-2.5 group"
              >
                <Image
                  src="/sa-logo.png"
                  alt=""
                  width={72}
                  height={32}
                  className="sa-logo h-8 w-auto shrink-0 object-contain"
                />
                <span className="font-semibold text-lg tracking-tight text-black dark:text-white group-hover:opacity-70 transition-opacity whitespace-nowrap">
                  SupplierAdvisor<span className="sa-text-brand-on-light">®</span>
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#6b7280] dark:text-slate-300">{t('footer.tagline')}</p>
              <p className="mt-2 max-w-xs text-sm text-[#6b7280] dark:text-slate-300">{t('footer.motto')}</p>
              <nav className="mt-4 -ms-2.5 flex items-center gap-1" aria-label={t('footer.social')}>
                {FOOTER_SOCIALS.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-black dark:text-white transition-opacity hover:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6]"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                      <path d={social.iconPath} />
                    </svg>
                  </a>
                ))}
              </nav>
              <div className="mt-8 space-y-2.5 text-sm text-[#6b7280] dark:text-slate-300">
                <a
                  href={FOOTER_CONTACT.email.href}
                  className="flex min-h-6 items-center gap-2 hover:text-[#0077b6] dark:hover:text-white"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="break-all">{FOOTER_CONTACT.email.label}</span>
                </a>
                <a
                  href={FOOTER_CONTACT.phone.href}
                  className="flex min-h-6 items-center gap-2 hover:text-[#0077b6] dark:hover:text-white"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  {FOOTER_CONTACT.phone.label}
                </a>
                <a
                  href={FOOTER_CONTACT.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-6 items-center gap-2 hover:text-[#0077b6] dark:hover:text-white"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  {t('footer.contact.whatsapp')}
                </a>
                <p className="pt-1 text-xs dark:text-slate-300">{t('footer.contact.country')}</p>
              </div>
              <div className="mt-8">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('footer.foundingTitle')}</p>
                <p className="text-sm text-[#6b7280] dark:text-slate-300 leading-relaxed mb-3">
                  {t('footer.foundingBlurb')}
                </p>
                <FooterFoundingForm />
              </div>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 lg:gap-10">
              <nav className="min-w-0 space-y-8" aria-label={t('footer.explore')}>
                {FOOTER_EXPLORE_GROUPS.map((group) => (
                  <FooterNav key={group.label} title={localizedGroupTitle(group.label)}>
                    <SimpleNav links={group.links} />
                  </FooterNav>
                ))}
              </nav>
              <FooterNav title={t('footer.industries')}>
                <GroupedNav
                  groups={FOOTER_INDUSTRY_GROUPS}
                  ariaLabel={t('footer.industriesBySector')}
                  lang="en"
                />
              </FooterNav>
              <FooterNav title={t('footer.resources')}>
                <GroupedNav
                  groups={FOOTER_RESOURCE_GROUPS}
                  ariaLabel={t('footer.resources')}
                  resolveLabel={localizedGroupTitle}
                />
              </FooterNav>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-black/[0.06] dark:border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-[#6b7280] dark:text-slate-300">
            <div className="space-y-1">
              <p>
                © <FooterYear /> SupplierAdvisor®. {t('footer.rights')}
              </p>
              <p>
                {t('footer.bigFiveCompany')}
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={t('footer.legalNav')}>
              {FOOTER_LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className="underline underline-offset-2 hover:text-[#0077b6] dark:hover:text-white"
                >
                  {localizedLabel(link)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
