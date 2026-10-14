import Image from 'next/image';
import { SA_LOGO_NATIVE, SA_LOGO_SRC, SA_LOGO_TICK_SRC } from '@/lib/brand/assets';

/**
 * Official SA artwork. Letters stay the real monogram; the tick is a
 * same-canvas mask so Advisor skins can recolour only the check.
 */
export function SaOfficialLogo({
  className = 'h-8 w-auto',
  title = 'SupplierAdvisor',
  priority = false,
}: {
  className?: string;
  title?: string;
  priority?: boolean;
}) {
  return (
    <span className={`sa-official-logo ${className}`} title={title}>
      <Image
        src={SA_LOGO_SRC}
        alt={title}
        width={SA_LOGO_NATIVE.width}
        height={SA_LOGO_NATIVE.height}
        priority={priority}
        sizes="180px"
        className="sa-logo-base"
        style={{ height: '100%', width: 'auto' }}
      />
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
