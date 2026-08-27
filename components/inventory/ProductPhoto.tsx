/**
 * Product / SKU photos (pack shots, labels, spec artwork).
 * Always show the full image — never crop header/footer with object-cover.
 */
export function ProductPhoto({
  src,
  alt = '',
  className = '',
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden bg-[#f8f7f5] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="sa-product-photo max-h-full max-w-full h-full w-full object-contain object-center"
      />
    </span>
  );
}
