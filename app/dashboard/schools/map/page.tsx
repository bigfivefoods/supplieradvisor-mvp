'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type SchoolPin = {
  id: number;
  school_name: string;
  province?: string | null;
  district?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  learner_count_enrolled?: number;
  has_coords?: boolean;
};

export default function SchoolsMapPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolPin[]>([]);
  const [withCoords, setWithCoords] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schools/map?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSchools(data.schools || []);
      setWithCoords(data.withCoords || 0);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School map"
        titleAccent="Locations"
        description={`${withCoords} of ${schools.length} schools have GPS coordinates. Set lat/lng on School profile.`}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 min-h-[320px] flex items-center justify-center p-8 text-center">
            <div>
              <MapPin className="w-10 h-10 text-[#00b4d8] mx-auto mb-3" />
              <p className="font-bold text-slate-900">
                {withCoords} geocoded schools
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Coordinates are stored on each school profile. Open external map
                links from the list for navigation. Full Leaflet map can reuse
                inventory transfer map components later.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden max-h-[480px] overflow-y-auto">
            <ul className="divide-y">
              {schools.map((s) => (
                <li
                  key={s.id}
                  className="px-4 py-3 flex justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{s.school_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {[s.district, s.province, s.city]
                        .filter(Boolean)
                        .join(' · ')}
                      {' · '}
                      {s.learner_count_enrolled ?? 0} learners
                    </p>
                  </div>
                  {s.has_coords ? (
                    <a
                      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#0077b6] hover:underline shrink-0"
                    >
                      Map →
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      No GPS
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
