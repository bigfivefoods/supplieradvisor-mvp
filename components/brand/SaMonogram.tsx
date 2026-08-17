/**
 * SupplierAdvisor monogram — letters follow `currentColor`,
 * the tick in the A follows `--sa-brand` so Advisor skins can recolour it.
 */
export function SaMonogram({
  className = 'h-8 w-auto',
  title = 'SupplierAdvisor',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 128"
      className={`sa-monogram ${className}`}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <path
        fill="currentColor"
        d="M116.8 27.2C116.8 11 100.8 0 72 0 42.4 0 21.2 13.2 17.2 37.6h26.4C46.8 27.4 57 21.2 72 21.2c16 0 25.2 6 25.2 16 0 8.4-6 13.4-21.6 17.4L37.2 66C17.6 70.8 6.8 82 6.8 100.4 6.8 118.8 24.4 128 53.6 128c32.4 0 53.2-14.2 58-38.2H85.2c-3.6 11.2-15.6 18.4-32.4 18.4-17.2 0-27.2-6.6-27.2-17 0-8.4 6-13.2 20.8-16.8l38.8-10.2c20.4-5.4 31.6-17.6 31.6-35.6z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M148 128 196.4 6h29.2L274 128h-30.4l-8.8-26.4h-47.2L178.8 128H148zm39.6-48.4h33.6L210.8 36l-23.2 43.6z"
      />
      <path
        className="sa-monogram-tick"
        d="M162.8 74.2 194 104.6 258.4 16.8c2.8-3.8 8.2-4.4 11.8-1.4 3.4 2.8 3.8 8 .8 11.6L203.6 123c-3.6 4.8-10.8 5.2-14.8.4l-39-43.6c-3.2-3.6-2.8-9.2.8-12.2 3.6-3.2 9.2-2.8 12.2 1.6z"
      />
    </svg>
  );
}
