import { formatQty, type PublicDeliveryNote } from '@/lib/customers/delivery-note';

type Props = {
  note: PublicDeliveryNote;
  pdfHref?: string | null;
};

export default function DeliveryNotePublicView({ note, pdfHref }: Props) {
  const initial = (note.sellerName || 'S').trim().charAt(0).toUpperCase() || 'S';
  return (
    <main className="bg-[#eef2f7] text-slate-900">
      <div className="mx-auto w-full max-w-lg px-3 py-4 md:max-w-3xl md:py-8">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#00b4d8] to-[#0077b6]" />
          <div className="space-y-5 p-4 md:p-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                {note.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={note.logoUrl}
                    alt=""
                    className="mb-3 max-h-12 max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-lg font-black text-white">
                    {initial}
                  </div>
                )}
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0077b6]">
                  Delivery note
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {note.number}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {note.partial ? 'Partial delivery' : 'Delivery'} · quantities and units only
                </p>
              </div>
              <div className="text-sm text-slate-600 md:text-right">
                <div className="font-bold text-slate-900">{note.sellerName}</div>
                {note.sellerAddress ? <div>{note.sellerAddress}</div> : null}
                {note.sellerPhone ? <div>{note.sellerPhone}</div> : null}
                {note.sellerEmail ? <div>{note.sellerEmail}</div> : null}
              </div>
            </header>

            <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-cyan-900">
              This delivery note is not a tax invoice. It shows goods delivered, with no prices.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Deliver to
                </h2>
                <p className="mt-1 font-bold">{note.customerName}</p>
                {note.contactName ? <p className="text-sm text-slate-600">{note.contactName}</p> : null}
                {note.contactPhone ? <p className="text-sm text-slate-600">{note.contactPhone}</p> : null}
                {note.deliveryAddress ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{note.deliveryAddress}</p>
                ) : null}
              </section>
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Delivery
                </h2>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Date</dt>
                    <dd className="font-semibold">{note.deliveryDate || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Invoice ref</dt>
                    <dd className="font-semibold">{note.invoiceNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Delivered by</dt>
                    <dd className="font-semibold">{note.deliveredBy || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Vehicle / reg</dt>
                    <dd className="font-semibold">{note.vehicleReg || '—'}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2 font-bold">#</th>
                    <th className="py-2 pr-2 font-bold">Description</th>
                    <th className="py-2 pr-2 text-right font-bold">Invoiced</th>
                    <th className="py-2 pr-2 text-right font-bold">Delivered</th>
                    <th className="py-2 text-right font-bold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {note.lines.map((line, i) => (
                    <tr key={`${line.name}-${i}`} className="border-b border-slate-200">
                      <td className="py-3 pr-2 text-slate-400">{i + 1}</td>
                      <td className="py-3 pr-2">
                        <div className="font-semibold">{line.name}</div>
                        {line.sku ? <div className="text-xs text-slate-500">{line.sku}</div> : null}
                      </td>
                      <td className="py-3 pr-2 text-right tabular-nums">{formatQty(line.invoicedQty)}</td>
                      <td className="py-3 pr-2 text-right font-bold tabular-nums">
                        {formatQty(line.deliveredQty)}
                      </td>
                      <td className="py-3 text-right text-slate-500">{line.uom || 'unit'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {note.notes ? (
              <section>
                <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-[#0077b6]">
                  Notes
                </h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{note.notes}</p>
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-3" aria-label="Received by">
              {[
                ['Received by', note.receivedByName || ''],
                ['Signature', ''],
                ['Date', note.receivedByDate || ''],
              ].map(([label, value]) => (
                <div key={label} className="min-h-[88px] rounded-xl border border-dashed border-slate-300 p-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {label}
                  </div>
                  <div className="mt-6 border-b border-slate-900 text-sm">{value}</div>
                </div>
              ))}
            </section>

            {pdfHref ? (
              <a
                href={pdfHref}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#00b4d8] px-4 py-3 text-sm font-bold text-white hover:bg-[#0077b6] md:w-auto"
              >
                Download PDF
              </a>
            ) : null}
          </div>
          <footer className="bg-slate-900 px-4 py-3 text-center text-xs text-slate-400">
            <div>
              Powered by <span className="font-extrabold text-[#00b4d8]">SupplierAdvisor®</span>
            </div>
            <div>Delivery note · quantities only</div>
          </footer>
        </article>
      </div>
    </main>
  );
}
