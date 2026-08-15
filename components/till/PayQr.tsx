'use client';

export function PayQr({
  url,
  size = 240,
  label,
}: {
  url: string;
  size?: number;
  label?: string;
}) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label || 'Scan to pay'}
        width={size}
        height={size}
        className="rounded-2xl border border-slate-200 bg-white p-2"
      />
      <p className="max-w-[16rem] break-all text-center text-[10px] text-slate-400">
        {url}
      </p>
    </div>
  );
}
