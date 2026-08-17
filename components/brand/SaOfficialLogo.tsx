import { SA_LOGO_SRC, SA_LOGO_TICK_SRC } from '@/lib/brand/assets';

/**
 * Official SA artwork. Letters stay the real monogram; the tick is a
 * same-canvas mask so Advisor skins can recolour only the check.
 */
export function SaOfficialLogo({
  className = 'h-8 w-auto',
  title = 'SupplierAdvisor',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span className={`sa-official-logo ${className}`} title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SA_LOGO_SRC} alt={title} className="sa-logo-base" />
      <span
        className="sa-logo-tick"
        style={{
          WebkitMaskImage: `url(${SA_LOGO_TICK_SRC})`,
          maskImage: `url(${SA_LOGO_TICK_SRC})`,
        }}
        aria-hidden
      />
    </span>
  );
}
