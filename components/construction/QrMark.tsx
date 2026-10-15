'use client';

import { qrMatrix } from '@/lib/construction/qr';

export function QrMark({ value }: { value: string }) {
  const matrix = qrMatrix(value);
  const quiet = 2;
  const dim = matrix.size + quiet * 2;
  return (
    <svg
      data-testid="portal-qr"
      role="img"
      aria-label="QR code for this ConstructionAdvisor® link"
      viewBox={`0 0 ${dim} ${dim}`}
      className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-1 text-[#0f172a]"
      shapeRendering="crispEdges"
    >
      {matrix.modules.flatMap((row, y) =>
        row.map((cell, x) =>
          cell ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1} height={1} fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
}
