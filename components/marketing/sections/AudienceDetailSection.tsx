export default function AudienceDetailSection({
  title,
  body,
  bullets,
}: {
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
      <p className="mt-3 text-slate-600">{body}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-slate-700">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4d8]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
