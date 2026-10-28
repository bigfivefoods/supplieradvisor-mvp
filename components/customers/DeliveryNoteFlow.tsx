'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const STEPS = [
  'Open the invoice',
  'Confirm delivered quantities (partial delivery is allowed)',
  'Add who delivered, the vehicle, and a note',
  'Share the public link on WhatsApp or download the PDF',
  'The recipient signs received-by',
];

/** How a delivery note moves from invoice to signature. Collapsed until opened. */
export default function DeliveryNoteFlow() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls="delivery-note-flow"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-[#0077b6] transition-transform ${
            open ? '' : '-rotate-90'
          }`}
          aria-hidden
        />
        <span>
          <h2 className="text-sm font-bold text-slate-900">Delivery note flow</h2>
          <p className="text-xs text-slate-500">
            Invoice to signed receipt, shared on WhatsApp. No prices on the note.
          </p>
        </span>
      </button>
      <div id="delivery-note-flow" hidden={!open} className="px-4 pb-4">
        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00b4d8] text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
