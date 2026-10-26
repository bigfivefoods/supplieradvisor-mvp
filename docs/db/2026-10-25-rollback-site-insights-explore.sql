-- Rollback for 20261041_site_insights_explore_speed.sql.
-- Restores the site_insights_explore body that was live on production on
-- 25 Oct 2026 (the per-visitor nested loop). Run this only to undo that
-- migration. It does not drop indexes.

CREATE OR REPLACE FUNCTION public.site_insights_explore(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_sites text[],
  p_tz text DEFAULT 'Africa/Johannesburg'::text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $fn$

declare
  v_sites text[];
  v_tz text := case when p_tz in ('Africa/Johannesburg', 'UTC') then p_tz else 'Africa/Johannesburg' end;
  v_ext timestamptz;
  v_from_day date;
  v_to_day date;
  out jsonb := '[]'::jsonb;
  s text;
begin
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'site_insights_explore: bad range';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_sites
  from unnest(coalesce(p_sites, '{}'::text[])) as x
  where x in ('bigfivegroup.africa', 'super-cube.me', 'supplieradvisor.com');
  if cardinality(v_sites) = 0 or cardinality(v_sites) <> cardinality(coalesce(p_sites, '{}'::text[])) then
    raise exception 'site_insights_explore: bad site';
  end if;

  v_ext := least(p_from, p_to - interval '14 days');
  v_from_day := (p_from at time zone v_tz)::date;
  v_to_day := ((p_to - interval '1 second') at time zone v_tz)::date;

  drop table if exists _sx_e;
  create temporary table _sx_e on commit drop as
  with raw as (
    select e.id, e.ts, e.site, e.kind, e.visitor, e.vid, e.path, e.label, e.country, e.device,
           e.engaged_ms, e.scroll_pct, e.utm_source, e.utm_medium, e.utm_campaign, e.ref_domain, e.portal,
           lag(e.ts) over (partition by e.site, e.visitor order by e.ts, e.id) as prev_ts
    from public.site_insights_events e
    where e.site = any(v_sites) and e.ts >= v_ext - interval '30 minutes' and e.ts < p_to
      and e.visitor is not null
  )
  select r.*,
         sum(case when r.prev_ts is null or r.ts - r.prev_ts > interval '30 minutes' then 1 else 0 end)
           over (partition by r.site, r.visitor order by r.ts, r.id) as sn
  from raw r;
  delete from _sx_e where ts < v_ext;

  drop table if exists _sx_v;
  create temporary table _sx_v on commit drop as
  select site, visitor, sn,
    min(ts) filter (where kind = 'pageview') as start_ts,
    count(*) filter (where kind = 'pageview') as pv,
    coalesce(sum(engaged_ms) filter (where kind = 'engage'), 0) as dur,
    max(scroll_pct) filter (where kind = 'engage') as max_scroll,
    (array_agg(path order by ts, id) filter (where kind = 'pageview'))[1] as landing,
    (array_agg(path order by ts desc, id desc) filter (where kind = 'pageview'))[1] as exit_path,
    (array_agg(coalesce(nullif(utm_source, ''), nullif(ref_domain, ''), 'direct') order by ts, id) filter (where kind = 'pageview'))[1] as src,
    (array_agg(utm_medium order by ts, id) filter (where kind = 'pageview'))[1] as medium,
    (array_agg(utm_campaign order by ts, id) filter (where kind = 'pageview'))[1] as campaign,
    (array_agg(country order by ts, id) filter (where kind = 'pageview'))[1] as country,
    (array_agg(device order by ts, id) filter (where kind = 'pageview'))[1] as device,
    count(*) filter (where kind in ('pdf', 'enquiry', 'buy', 'install', 'feedback', 'signin')
                        or (kind = 'click' and label like 'cta-%')) as actions
  from _sx_e
  group by site, visitor, sn
  having count(*) filter (where kind = 'pageview') > 0;

  alter table _sx_v add column in_range boolean;
  alter table _sx_v add column engaged boolean;
  alter table _sx_v add column channel text;
  update _sx_v set in_range = start_ts >= p_from,
                   engaged = pv >= 2 or dur >= 10000 or coalesce(max_scroll, 0) >= 50,
                   channel = public.site_insights_channel(src, medium, campaign)
  where true;

  foreach s in array v_sites loop
    out := out || jsonb_build_array(jsonb_build_object(
      'site', s,
      'totals', (
        select jsonb_build_object('visits', count(*), 'engaged', count(*) filter (where engaged),
                                  'bounced', count(*) filter (where pv = 1), 'dur', coalesce(sum(dur), 0),
                                  'actionVisits', count(*) filter (where actions > 0), 'actions', coalesce(sum(actions), 0))
        from _sx_v where site = s and in_range
      ),
      'heat', (
        select coalesce(jsonb_agg(jsonb_build_array(d, h, n) order by d, h), '[]'::jsonb)
        from (
          select extract(isodow from start_ts at time zone v_tz)::int - 1 as d,
                 extract(hour from start_ts at time zone v_tz)::int as h, count(*) as n
          from _sx_v where site = s and in_range group by 1, 2
        ) x
      ),
      'sources', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select src as key, min(channel) as channel, count(*) as visits, count(*) filter (where engaged) as engaged,
                 count(*) filter (where pv = 1) as bounced, coalesce(sum(dur), 0) as dur,
                 coalesce(sum(max_scroll), 0) as "scrollSum", count(max_scroll) as "scrollN",
                 count(*) filter (where actions > 0) as "actionVisits"
          from _sx_v where site = s and in_range group by src order by count(*) desc, src limit 12
        ) x
      ),
      'channels', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select channel as key, count(*) as visits, count(*) filter (where engaged) as engaged,
                 count(*) filter (where pv = 1) as bounced, coalesce(sum(dur), 0) as dur,
                 coalesce(sum(max_scroll), 0) as "scrollSum", count(max_scroll) as "scrollN",
                 count(*) filter (where actions > 0) as "actionVisits"
          from _sx_v where site = s and in_range group by channel
        ) x
      ),
      'campaigns', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select coalesce(campaign, '(no campaign name)') as key, min(src) as source, min(medium) as medium,
                 count(*) as visits, count(*) filter (where engaged) as engaged,
                 count(*) filter (where actions > 0) as "actionVisits", coalesce(sum(actions), 0) as actions
          from _sx_v where site = s and in_range and (campaign is not null or medium is not null)
          group by coalesce(campaign, '(no campaign name)') order by count(*) desc limit 10
        ) x
      ),
      'actionKeys', (
        select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', n, 'visits', vs) order by n desc, k), '[]'::jsonb)
        from (
          select case when e.kind = 'click' then e.label else e.kind end as k, count(*) as n,
                 count(distinct (e.visitor, e.sn)) as vs
          from _sx_e e
          where e.site = s and e.ts >= p_from
            and (e.kind in ('pdf', 'enquiry', 'buy', 'install', 'feedback', 'signin') or (e.kind = 'click' and e.label like 'cta-%'))
          group by 1 order by 2 desc limit 12
        ) x
      ),
      'landing', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select landing as key, count(*) as visits, count(*) filter (where pv = 1) as bounced,
                 count(*) filter (where engaged) as engaged, count(*) filter (where actions > 0) as "actionVisits",
                 coalesce(sum(dur), 0) as dur
          from _sx_v where site = s and in_range group by landing order by count(*) desc, landing limit 15
        ) x
      ),
      'devices', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select d.key, d.visits, d.bounced, d.engaged, d.dur, d."actionVisits",
                 v.lcp, v.inp, v.cls, coalesce(v.n, 0) as "vitalsN"
          from (
            select coalesce(device, 'unknown') as key, count(*) as visits, count(*) filter (where pv = 1) as bounced,
                   count(*) filter (where engaged) as engaged, coalesce(sum(dur), 0) as dur,
                   count(*) filter (where actions > 0) as "actionVisits"
            from _sx_v where site = s and in_range group by 1
          ) d
          left join (
            select coalesce(device, 'unknown') as key,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'lcp'))::numeric, 0) as lcp,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'inp'))::numeric, 0) as inp,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'cls'))::numeric, 3) as cls,
                   count(*) filter (where metric = 'lcp') as n
            from public.site_insights_vitals
            where site = s and ts >= p_from and ts < p_to group by 1
          ) v using (key)
        ) x
      ),
      'speedPages', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.key), '[]'::jsonb)
        from (
          select v.key, v.lcp, v.inp, v.cls, v.n, coalesce(l.landings, 0) as landings, coalesce(l.bounced, 0) as bounced
          from (
            select path as key,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'lcp'))::numeric, 0) as lcp,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'inp'))::numeric, 0) as inp,
                   round((percentile_cont(0.75) within group (order by value) filter (where metric = 'cls'))::numeric, 3) as cls,
                   count(*) filter (where metric = 'lcp') as n
            from public.site_insights_vitals
            where site = s and ts >= p_from and ts < p_to group by path
          ) v
          left join (
            select landing as key, count(*) as landings, count(*) filter (where pv = 1) as bounced
            from _sx_v where site = s and in_range group by landing
          ) l using (key)
          where v.n > 0
          order by v.n desc, v.key limit 20
        ) x
      ),
      'countries', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.visits desc, x.key), '[]'::jsonb)
        from (
          select coalesce(country, '??') as key, count(*) as visits, count(*) filter (where pv = 1) as bounced,
                 count(*) filter (where engaged) as engaged, coalesce(sum(dur), 0) as dur,
                 count(*) filter (where actions > 0) as "actionVisits"
          from _sx_v where site = s and in_range group by 1 order by count(*) desc, 1 limit 15
        ) x
      ),
      
      'newReturning', (
        select coalesce(jsonb_agg(jsonb_build_object('t', to_char(x.d, 'YYYY-MM-DD'), 'new', x.nw, 'returning', x.rt) order by x.d), '[]'::jsonb)
        from (
          select a.d, count(*) filter (where f.first_day = a.d) as nw, count(*) filter (where f.first_day < a.d) as rt
          from (
            select distinct (ts at time zone v_tz)::date as d, vid
            from _sx_e where site = s and kind = 'pageview' and vid is not null and ts >= p_from
          ) a
          join (
            select e.vid, (min(e.ts) at time zone v_tz)::date as first_day
            from public.site_insights_events e
            where e.site = s and e.kind = 'pageview'
              and e.vid in (select distinct vid from _sx_e where site = s and vid is not null)
            group by e.vid
          ) f using (vid)
          group by a.d
        ) x
      ),

      'content', (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.pageviews desc, x.key), '[]'::jsonb)
        from (
          select p.key, p.pageviews, p.visitors, p."durSum", p."durN", p."scrollSum", p."scrollN",
                 (select count(*) from _sx_v v where v.site = s and v.in_range and v.landing = p.key) as entrances,
                 (select count(*) from _sx_v v where v.site = s and v.in_range and v.exit_path = p.key) as exits,
                 (select jsonb_agg(coalesce(c.n, 0) order by g.d)
                  from generate_series(v_from_day, v_to_day, interval '1 day') as g(d)
                  left join (
                    select (ts at time zone v_tz)::date as d, count(*) as n
                    from _sx_e where site = s and kind = 'pageview' and path = p.key and ts >= p_from group by 1
                  ) c on c.d = g.d::date) as spark
          from (
            select path as key, count(*) filter (where kind = 'pageview') as pageviews,
                   count(distinct visitor) filter (where kind = 'pageview') as visitors,
                   coalesce(sum(engaged_ms) filter (where kind = 'engage'), 0) as "durSum",
                   count(engaged_ms) filter (where kind = 'engage') as "durN",
                   coalesce(sum(scroll_pct) filter (where kind = 'engage'), 0) as "scrollSum",
                   count(scroll_pct) filter (where kind = 'engage') as "scrollN"
            from _sx_e
            where site = s and ts >= p_from and kind in ('pageview', 'engage') and portal is null
            group by path having count(*) filter (where kind = 'pageview') > 0
            order by 2 desc, 1 limit 15
          ) p
        ) x
      ),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object('t', to_char(g.d, 'YYYY-MM-DD'), 'visits', coalesce(v.visits, 0),
                 'visitors', coalesce(v.visitors, 0), 'pageviews', coalesce(v.pv, 0), 'bounced', coalesce(v.bounced, 0),
                 'engaged', coalesce(v.engaged, 0), 'dur', coalesce(v.dur, 0), 'actionVisits', coalesce(v.av, 0)) order by g.d), '[]'::jsonb)
        from generate_series((v_ext at time zone v_tz)::date, v_to_day, interval '1 day') as g(d)
        left join (
          select (start_ts at time zone v_tz)::date as d, count(*) as visits, count(distinct visitor) as visitors,
                 sum(pv) as pv, count(*) filter (where pv = 1) as bounced, count(*) filter (where engaged) as engaged,
                 sum(dur) as dur, count(*) filter (where actions > 0) as av
          from _sx_v where site = s group by 1
        ) v on v.d = g.d::date
      ),
      'wow', (
        select jsonb_build_object(
          'cur', jsonb_build_object('visits', count(*) filter (where c), 'visitors', count(distinct visitor) filter (where c),
                   'pageviews', coalesce(sum(pv) filter (where c), 0), 'bounced', count(*) filter (where c and pv = 1),
                   'engaged', count(*) filter (where c and engaged), 'dur', coalesce(sum(dur) filter (where c), 0),
                   'actionVisits', count(*) filter (where c and actions > 0)),
          'prev', jsonb_build_object('visits', count(*) filter (where pr), 'visitors', count(distinct visitor) filter (where pr),
                   'pageviews', coalesce(sum(pv) filter (where pr), 0), 'bounced', count(*) filter (where pr and pv = 1),
                   'engaged', count(*) filter (where pr and engaged), 'dur', coalesce(sum(dur) filter (where pr), 0),
                   'actionVisits', count(*) filter (where pr and actions > 0)))
        from (
          select *, start_ts >= p_to - interval '7 days' as c,
                 start_ts >= p_to - interval '14 days' and start_ts < p_to - interval '7 days' as pr
          from _sx_v where site = s
        ) w
      )
    ));
  end loop;
  return jsonb_build_object('sites', out, 'from', p_from, 'to', p_to, 'tz', v_tz);
end;

$fn$;
