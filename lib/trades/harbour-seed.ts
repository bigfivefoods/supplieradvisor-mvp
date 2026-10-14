/**
 * Harbour Plumbing — the TradeAdvisor® sample book.
 * A Cape Town plumber, three people, eight clients, a job in every stage.
 */
import { SA_VAT_RATE, emptyTradeStore, quoteTotals, type QuoteLine, type TradegraphStore } from './tradegraph';
import {
  HARBOUR_NOW,
  type Book,
  type DeskState,
  type GanttTask,
  type PriceItem,
  type Programme,
  lockBaseline,
} from './desk';

const DAY = '2026-10-14';

function day(offset: number): string {
  const t = Date.parse(`${DAY}T00:00:00Z`) + offset * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function line(id: string, description: string, qty: number, unit_cents: number): QuoteLine {
  return { id, description, qty, unit_cents };
}

function task(partial: GanttTask): GanttTask {
  return partial;
}

export function seedHarbourBook(now = HARBOUR_NOW): Book {
  const store = emptyTradeStore(now, 'tg_harbour');
  store.settings = {
    brand_name: 'Harbour Plumbing',
    trade: 'plumber',
    public_token: 'tg_harbour',
    vat_rate: SA_VAT_RATE,
    phone: '021 555 0144',
    city: 'Cape Town',
    notify_email: 'amina@harbourplumbing.co.za',
  };

  const price: PriceItem[] = [
    { id: 'pb_call', kind: 'callout', name: 'Call-out, Cape Town', unit: 'visit', cost_cents: 35_000, markup_pct: 28, sku: 'CALL-CT' },
    { id: 'pb_hour', kind: 'labour', name: 'Plumber hour', unit: 'hour', cost_cents: 48_000, markup_pct: 35, sku: 'LAB-PL' },
    { id: 'pb_app', kind: 'labour', name: 'Apprentice hour', unit: 'hour', cost_cents: 22_000, markup_pct: 30, sku: 'LAB-AP' },
    { id: 'pb_copper', kind: 'material', name: '15mm copper, per metre', unit: 'm', cost_cents: 4_800, markup_pct: 25, sku: 'CU-15' },
    { id: 'pb_trap', kind: 'material', name: 'Bottle trap', unit: 'each', cost_cents: 18_500, markup_pct: 30, sku: 'TR-BT' },
    { id: 'pb_valve', kind: 'material', name: 'Isolation valve 15mm', unit: 'each', cost_cents: 9_500, markup_pct: 32, sku: 'VL-15' },
    { id: 'pb_geyser', kind: 'material', name: 'Geyser valve and drip tray', unit: 'set', cost_cents: 64_000, markup_pct: 22, sku: 'GY-SET' },
    { id: 'pb_waste', kind: 'material', name: '50mm waste pipe, per metre', unit: 'm', cost_cents: 6_200, markup_pct: 25, sku: 'WS-50' },
  ];

  const customers = [
    cust('tc_naledi', 'Naledi Petersen', 'naledi@example.com', '082 555 0101', '14 Balfour Road', 'Rondebosch'),
    cust('tc_sipho', 'Sipho Dlamini', 'sipho@example.com', '083 555 0102', '8 Voortrekker Road', 'Bellville'),
    cust('tc_thandi', 'Thandi Nkosi', 'thandi@example.com', '082 555 0103', '22 Lower Main Road', 'Observatory'),
    cust('tc_johan', 'Johan Botha', 'johan@example.com', '084 555 0104', '6 Herschel Road', 'Claremont'),
    cust('tc_fatima', 'Fatima Khan', 'fatima@example.com', '082 555 0105', '91 Sir Lowry Road', 'Woodstock'),
    cust('tc_pieter', 'Pieter Naidoo', 'pieter.n@example.com', '083 555 0106', '4 Summerley Road', 'Kenilworth'),
    cust('tc_ayesha', 'Ayesha Mohamed', 'ayesha@example.com', '082 555 0107', '17 Durban Road', 'Mowbray'),
    cust('tc_david', 'David Meyer', 'david@example.com', '084 555 0108', '3 Beach Road', 'Sea Point'),
  ];

  const wasteLines = [
    line('tl_waste_call', 'Call-out, Cape Town', 1, 44_800),
    line('tl_waste_lab', 'Plumber hour', 6, 64_800),
    line('tl_waste_pipe', '50mm waste pipe, per metre', 8, 7_750),
  ];
  const wasteTotals = quoteTotals(wasteLines, SA_VAT_RATE);
  const tapLines = [line('tl_tap', 'Replace basin taps, labour and parts', 1, 95_000)];
  const tapTotals = quoteTotals(tapLines, SA_VAT_RATE);
  const mixerLines = [line('tl_mixer', 'Kitchen mixer cartridge and labour', 1, 72_000)];
  const mixerTotals = quoteTotals(mixerLines, SA_VAT_RATE);
  const geyserLines = [
    line('tl_g_call', 'Call-out, Cape Town', 1, 44_800),
    line('tl_g_set', 'Geyser valve and drip tray', 1, 78_080),
    line('tl_g_lab', 'Plumber hour', 3, 64_800),
  ];
  const geyserTotals = quoteTotals(geyserLines, SA_VAT_RATE);
  const outsideLines = [line('tl_out', 'Outside tap and vacuum breaker', 1, 54_000)];
  const outsideTotals = quoteTotals(outsideLines, SA_VAT_RATE);

  const quotes = [
    {
      id: 'tq_waste',
      number: 'Q-2401',
      customer_id: 'tc_naledi',
      status: 'accepted' as const,
      title: 'Reroute bathroom waste',
      lines: wasteLines,
      source_request_id: null,
      created_at: `${day(-6)}T09:00:00.000Z`,
    },
    {
      id: 'tq_basin',
      number: 'Q-2410',
      customer_id: 'tc_sipho',
      status: 'sent' as const,
      title: 'Replace basin taps',
      lines: [line('tl_basin_q', 'Basin taps, flexi and labour', 1, 128_000)],
      source_request_id: null,
      created_at: `${day(-1)}T11:00:00.000Z`,
    },
    {
      id: 'tq_thandi',
      number: 'Q-2394',
      customer_id: 'tc_thandi',
      status: 'accepted' as const,
      title: 'Leaking basin',
      lines: tapLines,
      source_request_id: null,
      created_at: `${day(-3)}T08:00:00.000Z`,
    },
    {
      id: 'tq_mixer',
      number: 'Q-2388',
      customer_id: 'tc_johan',
      status: 'accepted' as const,
      title: 'Dripping mixer',
      lines: mixerLines,
      source_request_id: null,
      created_at: `${day(-8)}T08:00:00.000Z`,
    },
    {
      id: 'tq_geyser',
      number: 'Q-2370',
      customer_id: 'tc_fatima',
      status: 'accepted' as const,
      title: 'Burst geyser repair',
      lines: geyserLines,
      source_request_id: null,
      created_at: `${day(-20)}T08:00:00.000Z`,
    },
    {
      id: 'tq_out',
      number: 'Q-2360',
      customer_id: 'tc_pieter',
      status: 'accepted' as const,
      title: 'Outside tap',
      lines: outsideLines,
      source_request_id: null,
      created_at: `${day(-30)}T08:00:00.000Z`,
    },
    {
      id: 'tq_bath',
      number: 'Q-2412',
      customer_id: 'tc_ayesha',
      status: 'sent' as const,
      title: 'Bathroom rough-in',
      lines: [line('tl_bath', 'Rough-in labour and first fix', 1, 640_000)],
      source_request_id: null,
      created_at: `${day(-2)}T10:00:00.000Z`,
    },
    {
      id: 'tq_lost',
      number: 'Q-2355',
      customer_id: 'tc_david',
      status: 'declined' as const,
      title: 'Move the kitchen sink',
      lines: [line('tl_lost', 'Relocate sink', 1, 210_000)],
      source_request_id: null,
      created_at: `${day(-12)}T10:00:00.000Z`,
    },
  ];

  const jobs = [
    job('tj_waste', 'J-1808', 'tc_naledi', 'tq_waste', 'Reroute bathroom waste', 'in_progress', '14 Balfour Road, Rondebosch', 55, wasteLines),
    job('tj_thandi', 'J-1810', 'tc_thandi', 'tq_thandi', 'Leaking basin', 'scheduled', '22 Lower Main Road, Observatory', 0, tapLines),
    job('tj_mixer', 'J-1802', 'tc_johan', 'tq_mixer', 'Dripping mixer', 'done', '6 Herschel Road, Claremont', 100, mixerLines),
    job('tj_geyser', 'J-1790', 'tc_fatima', 'tq_geyser', 'Burst geyser repair', 'invoiced', '91 Sir Lowry Road, Woodstock', 100, geyserLines),
    job('tj_out', 'J-1780', 'tc_pieter', 'tq_out', 'Outside tap', 'paid', '4 Summerley Road, Kenilworth', 100, outsideLines),
    job('tj_david', 'J-1814', 'tc_david', null, 'Kitchen sink smell after rain', 'enquiry', '3 Beach Road, Sea Point', 0, []),
    job('tj_ayesha', 'J-1812', 'tc_ayesha', 'tq_bath', 'Bathroom rough-in', 'quoted', '17 Durban Road, Mowbray', 0, quotes[6]!.lines),
  ];
  jobs[0]!.updates = [
    {
      id: 'tu_waste_shared',
      at: `${day(-1)}T15:00:00.000Z`,
      note: 'Old waste is out. The new run is clipped. We test tomorrow morning.',
      progress_pct: 55,
      photo_url: '/share/industries/trades.png',
      shared: true,
    },
    {
      id: 'tu_waste_private',
      at: `${day(-1)}T15:10:00.000Z`,
      note: 'Joist is soft behind the bath. Do not share this until we price the VO.',
      progress_pct: 55,
      photo_url: null,
      shared: false,
    },
  ];

  const attend = task({
    id: 'gt_attend',
    name: 'Attend and isolate',
    kind: 'task',
    plan_start: day(-4),
    plan_end: day(-4),
    start: day(-4),
    end: day(-4),
    actual_start: day(-4),
    actual_end: day(-4),
    progress_pct: 100,
    depends_on: [],
    assignee_id: 'tm_lerato',
    vo_id: null,
    vo_number: null,
  });
  const strip = task({
    id: 'gt_strip',
    name: 'Strip and prepare',
    kind: 'task',
    plan_start: day(-3),
    plan_end: day(-2),
    start: day(-3),
    end: day(-1),
    actual_start: day(-3),
    actual_end: day(-1),
    progress_pct: 100,
    depends_on: ['gt_attend'],
    assignee_id: 'tm_lerato',
    vo_id: null,
    vo_number: null,
  });
  const fit = task({
    id: 'gt_fit',
    name: 'Fit and test',
    kind: 'task',
    plan_start: day(-1),
    plan_end: day(0),
    start: day(0),
    end: day(2),
    actual_start: day(0),
    actual_end: null,
    progress_pct: 45,
    depends_on: ['gt_strip'],
    assignee_id: 'tm_lerato',
    vo_id: null,
    vo_number: null,
  });
  const valves = task({
    id: 'gt_valves',
    name: 'Fit isolation valves',
    kind: 'task',
    plan_start: day(1),
    plan_end: day(1),
    start: day(1),
    end: day(1),
    actual_start: null,
    actual_end: null,
    progress_pct: 0,
    depends_on: ['gt_fit'],
    assignee_id: 'tm_pieter',
    vo_id: 'tv_valves',
    vo_number: 'VO-001',
  });
  const coc = task({
    id: 'gt_coc',
    name: 'Compliance certificate',
    kind: 'milestone',
    plan_start: day(1),
    plan_end: day(1),
    start: day(3),
    end: day(3),
    actual_start: null,
    actual_end: null,
    progress_pct: 0,
    depends_on: ['gt_valves'],
    assignee_id: 'tm_amina',
    vo_id: null,
    vo_number: null,
  });
  const hand = task({
    id: 'gt_hand',
    name: 'Handover',
    kind: 'milestone',
    plan_start: day(2),
    plan_end: day(2),
    start: day(3),
    end: day(3),
    actual_start: null,
    actual_end: null,
    progress_pct: 0,
    depends_on: ['gt_coc'],
    assignee_id: 'tm_lerato',
    vo_id: null,
    vo_number: null,
  });

  const wasteProgramme: Programme = {
    job_id: 'tj_waste',
    tasks: [attend, strip, fit, valves, coc, hand],
    baseline: null,
    history: [],
    contract_cents: wasteTotals.subtotal_cents,
    notes: 'Access through the bathroom floor. Granny flat is a second site.',
    checklist: [
      { id: 'ck_iso', label: 'Water isolated and tagged', done: true },
      { id: 'ck_before', label: 'Photos before work', done: true },
      { id: 'ck_walk', label: 'Customer walked through the finish', done: false },
    ],
    photos: [
      {
        id: 'ph_before',
        phase: 'before',
        url: '/share/industries/trades.png',
        caption: 'Old waste sagging under the bath',
        at: `${day(-4)}T08:20:00.000Z`,
      },
      {
        id: 'ph_after',
        phase: 'after',
        url: '/share/industries/construction-building.png',
        caption: 'New 50mm run clipped to the joist',
        at: `${day(-1)}T15:00:00.000Z`,
      },
    ],
    time_entries: [
      { id: 'te_1', member_id: 'tm_lerato', minutes: 210, note: 'Strip out', at: `${day(-3)}T16:00:00.000Z` },
      { id: 'te_2', member_id: 'tm_pieter', minutes: 90, note: 'Cut and deburr', at: `${day(-1)}T12:00:00.000Z` },
    ],
    assignees: ['tm_lerato', 'tm_pieter'],
    materials_used: [
      { id: 'mu_1', description: '50mm waste pipe', qty: 6, unit_cents: 7_750, price_item_id: 'pb_waste' },
    ],
  };
  const locked = lockBaseline(
    {
      ...wasteProgramme,
      tasks: wasteProgramme.tasks.map((row) => ({
        ...row,
        start: row.plan_start,
        end: row.plan_end,
      })),
    },
    `${day(-5)}T07:30:00.000Z`,
    'Locked when the quote was accepted'
  );
  wasteProgramme.baseline = locked.baseline;
  wasteProgramme.tasks = wasteProgramme.tasks.map((row) => {
    const planned = locked.tasks.find((item) => item.id === row.id);
    return planned ? { ...row, plan_start: planned.plan_start, plan_end: planned.plan_end } : row;
  });

  const thandiProgramme: Programme = {
    ...blankProgramme('tj_thandi', tapTotals.subtotal_cents, ['tm_pieter']),
    tasks: [
      task({
        id: 'gt_thandi',
        name: 'Replace basin taps',
        kind: 'task',
        plan_start: day(0),
        plan_end: day(0),
        start: day(0),
        end: day(0),
        actual_start: null,
        actual_end: null,
        progress_pct: 0,
        depends_on: [],
        assignee_id: 'tm_pieter',
        vo_id: null,
        vo_number: null,
      }),
      task({
        id: 'gt_thandi_hand',
        name: 'Handover',
        kind: 'milestone',
        plan_start: day(0),
        plan_end: day(0),
        start: day(0),
        end: day(0),
        actual_start: null,
        actual_end: null,
        progress_pct: 0,
        depends_on: ['gt_thandi'],
        assignee_id: 'tm_pieter',
        vo_id: null,
        vo_number: null,
      }),
    ],
  };

  const desk: DeskState = {
    price_book: price,
    team: [
      {
        id: 'tm_amina',
        name: 'Amina Jacobs',
        role: 'owner',
        trade: 'Master plumber',
        email: 'amina@harbourplumbing.co.za',
        phone: '082 555 0190',
        colour: '#0077b6',
        portal_token: 'crew_amina',
        member_user_id: '',
      },
      {
        id: 'tm_lerato',
        name: 'Lerato Molefe',
        role: 'technician',
        trade: 'Plumber',
        email: 'lerato@harbourplumbing.co.za',
        phone: '083 555 0191',
        colour: '#00b4d8',
        portal_token: 'crew_lerato',
        member_user_id: '',
      },
      {
        id: 'tm_pieter',
        name: 'Pieter van Wyk',
        role: 'technician',
        trade: 'Apprentice',
        email: 'pieter@harbourplumbing.co.za',
        phone: '084 555 0192',
        colour: '#0f766e',
        portal_token: 'crew_pieter',
        member_user_id: '',
      },
    ],
    sites: [
      { id: 'st_home', customer_id: 'tc_naledi', label: 'House', address: '14 Balfour Road', suburb: 'Rondebosch', city: 'Cape Town' },
      { id: 'st_flat', customer_id: 'tc_naledi', label: 'Granny flat', address: '14A Balfour Road', suburb: 'Rondebosch', city: 'Cape Town' },
      { id: 'st_sipho', customer_id: 'tc_sipho', label: 'Home', address: '8 Voortrekker Road', suburb: 'Bellville', city: 'Cape Town' },
    ],
    templates: [
      {
        id: 'tp_burst',
        name: 'Burst pipe',
        title: 'Burst pipe repair',
        deposit_pct: 0,
        lines: [line('x', 'Call-out, Cape Town', 1, 44_800), line('y', 'Plumber hour', 2, 64_800)],
      },
      {
        id: 'tp_geyser',
        name: 'Geyser swap',
        title: 'Geyser valve and tray',
        deposit_pct: 50,
        lines: [line('g1', 'Geyser valve and drip tray', 1, 78_080), line('g2', 'Plumber hour', 3, 64_800)],
      },
    ],
    programmes: [wasteProgramme, thandiProgramme, blankProgramme('tj_mixer', mixerTotals.subtotal_cents, ['tm_lerato']), blankProgramme('tj_geyser', geyserTotals.subtotal_cents, ['tm_amina']), blankProgramme('tj_out', outsideTotals.subtotal_cents, ['tm_pieter']), blankProgramme('tj_david', 0, []), blankProgramme('tj_ayesha', 0, ['tm_lerato'])],
    quote_meta: [
      meta('tq_waste', 0, `${day(-6)}T09:30:00.000Z`, { name: 'Naledi Petersen', signed_at: `${day(-5)}T07:30:00.000Z`, mark: 'Naledi Petersen' }),
      meta('tq_basin', 30, `${day(-1)}T11:05:00.000Z`, null),
      meta('tq_bath', 40, `${day(-2)}T10:10:00.000Z`, null),
      meta('tq_thandi', 0, `${day(-3)}T08:10:00.000Z`, { name: 'Thandi Nkosi', signed_at: `${day(-3)}T09:00:00.000Z`, mark: 'Thandi Nkosi' }),
    ],
    variations: [
      {
        id: 'tv_valves',
        number: 'VO-001',
        job_id: 'tj_waste',
        title: 'Fit isolation valves',
        scope: 'Add two 15mm isolation valves so the bathroom can be shut off without the house.',
        status: 'approved',
        cost_cents: 125_000,
        days: 1,
        photo_urls: ['/share/industries/trades.png'],
        lines: [line('tl_vo_valves', 'Isolation valves and labour', 1, 125_000)],
        signature: { name: 'Naledi Petersen', signed_at: `${day(-2)}T18:00:00.000Z`, mark: 'Naledi Petersen' },
        created_at: `${day(-3)}T16:00:00.000Z`,
      },
      {
        id: 'tv_gully',
        number: 'VO-002',
        job_id: 'tj_waste',
        title: 'Move the gully',
        scope: 'The gully sits under the new bath. Shift it 400mm and make good the paving.',
        status: 'sent',
        cost_cents: 186_000,
        days: 2,
        photo_urls: ['/share/industries/construction-building.png'],
        lines: [line('tl_vo_gully', 'Move gully and make good', 1, 186_000)],
        signature: null,
        created_at: `${day(-1)}T16:30:00.000Z`,
      },
    ],
    invoice_meta: [
      { invoice_id: 'ti_deposit', kind: 'deposit', due_on: day(-2), percent: 30, vo_id: null, pay_reference: '', pay_url: '' },
      { invoice_id: 'ti_geyser', kind: 'final', due_on: day(-4), percent: 100, vo_id: null, pay_reference: '', pay_url: '' },
      { invoice_id: 'ti_out', kind: 'final', due_on: day(-20), percent: 100, vo_id: null, pay_reference: 'tg_INV1780', pay_url: '' },
      { invoice_id: 'ti_vo', kind: 'variation', due_on: day(5), percent: null, vo_id: 'tv_valves', pay_reference: '', pay_url: '' },
    ],
    messages: [
      {
        id: 'mg_1',
        customer_id: 'tc_naledi',
        job_id: 'tj_waste',
        from: 'desk',
        body: 'Lerato is on site from 07:30. Please keep the bathroom clear.',
        at: `${day(0)}T06:10:00.000Z`,
      },
      {
        id: 'mg_2',
        customer_id: 'tc_naledi',
        job_id: 'tj_waste',
        from: 'customer',
        body: 'Thank you. The dog is in the yard.',
        at: `${day(0)}T06:22:00.000Z`,
      },
    ],
    documents: [
      { id: 'doc_coc', customer_id: 'tc_pieter', job_id: 'tj_out', kind: 'coc', title: 'Plumbing CoC', number: 'COC-2026-118' },
      { id: 'doc_war', customer_id: 'tc_pieter', job_id: 'tj_out', kind: 'warranty', title: 'Workmanship warranty, 12 months', number: 'WAR-118' },
      { id: 'doc_pirb', customer_id: 'tc_naledi', job_id: 'tj_waste', kind: 'licence', title: 'PIRB registration', number: 'PIRB-4481' },
    ],
    bookings: [
      {
        id: 'bk_sipho',
        customer_id: 'tc_sipho',
        starts_at: `${day(2)}T09:00:00.000Z`,
        ends_at: `${day(2)}T11:00:00.000Z`,
        note: 'Quote visit for the basin',
        status: 'requested',
      },
    ],
    availability: [
      { id: 'av_l', member_id: 'tm_lerato', weekday: 3, start: '07:00', end: '16:00' },
      { id: 'av_p', member_id: 'tm_pieter', weekday: 3, start: '07:30', end: '16:00' },
    ],
    tasks: [
      { id: 'dk_copper', title: 'Order 15mm copper from the supplier book', due: day(1), assignee_id: 'tm_amina', job_id: 'tj_waste', done: false },
      { id: 'dk_coc', title: 'Issue CoC after the test', due: day(3), assignee_id: 'tm_amina', job_id: 'tj_waste', done: false },
    ],
    reviews: [
      { id: 'rv_1', customer_id: 'tc_pieter', job_id: 'tj_out', score: 5, comment: 'On time, tidy, and the tap does not drip.' },
    ],
    notices: [
      { id: 'nt_1', title: 'Rondebosch Thursday', body: 'Lerato and Pieter are in Rondebosch. Keep the van stocked with 15mm fittings.', at: `${day(0)}T05:00:00.000Z` },
    ],
    customer_links: customers.map((row) => ({ customer_id: row.id, connection_id: null })),
    logo_data_url: '',
  };

  const full: TradegraphStore = {
    ...store,
    customers,
    quotes,
    jobs,
    invoices: [
      {
        id: 'ti_deposit',
        number: 'INV-1788',
        customer_id: 'tc_naledi',
        job_id: 'tj_waste',
        status: 'part_paid',
        subtotal_cents: Math.round(wasteTotals.total_cents * 0.3 / 1.15),
        vat_cents: Math.round(wasteTotals.total_cents * 0.3) - Math.round(wasteTotals.total_cents * 0.3 / 1.15),
        total_cents: Math.round(wasteTotals.total_cents * 0.3),
        issued_at: `${day(-5)}T08:00:00.000Z`,
      },
      {
        id: 'ti_vo',
        number: 'INV-1794',
        customer_id: 'tc_naledi',
        job_id: 'tj_waste',
        status: 'issued',
        ...quoteTotals([line('vo', 'VO-001', 1, 125_000)], SA_VAT_RATE),
        issued_at: `${day(-2)}T09:00:00.000Z`,
      },
      {
        id: 'ti_geyser',
        number: 'INV-1760',
        customer_id: 'tc_fatima',
        job_id: 'tj_geyser',
        status: 'issued',
        ...geyserTotals,
        issued_at: `${day(-12)}T09:00:00.000Z`,
      },
      {
        id: 'ti_out',
        number: 'INV-1740',
        customer_id: 'tc_pieter',
        job_id: 'tj_out',
        status: 'paid',
        ...outsideTotals,
        issued_at: `${day(-25)}T09:00:00.000Z`,
      },
    ],
    payments: [
      {
        id: 'tp_dep',
        invoice_id: 'ti_deposit',
        customer_id: 'tc_naledi',
        amount_cents: 50_000,
        paid_at: `${day(-4)}T10:00:00.000Z`,
        method: 'EFT',
      },
      {
        id: 'tp_out',
        invoice_id: 'ti_out',
        customer_id: 'tc_pieter',
        amount_cents: outsideTotals.total_cents,
        paid_at: `${day(-18)}T10:00:00.000Z`,
        method: 'Paystack',
      },
    ],
    materials: [
      {
        id: 'tm_voltex',
        supplier_id: null,
        supplier_name: 'Plumblink Claremont',
        job_id: 'tj_waste',
        status: 'ordered',
        created_at: `${day(-2)}T08:00:00.000Z`,
        lines: [line('ml_pipe', '50mm waste pipe', 10, 6_200)],
      },
    ],
    schedule: [
      {
        id: 'ts_thandi',
        job_id: 'tj_thandi',
        title: 'Basin — Thandi Nkosi',
        starts_at: `${day(0)}T09:00:00.000Z`,
        ends_at: `${day(0)}T11:00:00.000Z`,
        address: '22 Lower Main Road, Observatory',
      },
      {
        id: 'ts_waste',
        job_id: 'tj_waste',
        title: 'Waste test — Naledi Petersen',
        starts_at: `${day(0)}T07:30:00.000Z`,
        ends_at: `${day(0)}T12:00:00.000Z`,
        address: '14 Balfour Road, Rondebosch',
      },
      {
        id: 'ts_tomorrow',
        job_id: 'tj_waste',
        title: 'Continue waste — Lerato',
        starts_at: `${day(1)}T07:30:00.000Z`,
        ends_at: `${day(1)}T15:00:00.000Z`,
        address: '14 Balfour Road, Rondebosch',
      },
    ],
    compliance: [
      { id: 'tx_coc', kind: 'coc', number: 'COC-2026-118', holder: 'Harbour Plumbing', expires_on: day(18), job_id: 'tj_out' },
      { id: 'tx_pirb', kind: 'pirb', number: 'PIRB-4481', holder: 'Amina Jacobs', expires_on: day(-9), job_id: null },
      { id: 'tx_gas', kind: 'gas', number: 'GAS-77', holder: 'Harbour Plumbing', expires_on: day(400), job_id: null },
    ],
    requests: [
      {
        id: 'tr_fatima',
        customer_id: 'tc_fatima',
        description: 'Guest toilet keeps running after a flush.',
        address: '91 Sir Lowry Road, Woodstock',
        preferred_dates: 'Friday morning',
        photo_urls: [],
        status: 'new',
        created_at: `${day(0)}T07:00:00.000Z`,
      },
    ],
  };

  return { store: full, desk };
}

function cust(
  id: string,
  name: string,
  email: string,
  phone: string,
  address: string,
  suburb: string
) {
  return { id, name, email, phone, address, suburb, city: 'Cape Town' };
}

function job(
  id: string,
  number: string,
  customer_id: string,
  quote_id: string | null,
  title: string,
  status: TradegraphStore['jobs'][number]['status'],
  address: string,
  progress_pct: number,
  lines: QuoteLine[]
): TradegraphStore['jobs'][number] {
  return {
    id,
    number,
    customer_id,
    quote_id,
    title,
    status,
    address,
    progress_pct,
    lines,
    updates: [],
  };
}

function meta(
  quote_id: string,
  deposit_pct: number,
  sent_at: string | null,
  signature: { name: string; signed_at: string; mark: string } | null
) {
  return {
    quote_id,
    markup_pct: 0,
    deposit_pct,
    template_id: null,
    valid_until: day(14),
    options: [],
    signature,
    sent_at,
  };
}

function blankProgramme(jobId: string, contract_cents: number, assignees: string[]): Programme {
  return {
    job_id: jobId,
    tasks: [],
    baseline: null,
    history: [],
    contract_cents,
    notes: '',
    checklist: [],
    photos: [],
    time_entries: [],
    assignees,
    materials_used: [],
  };
}
