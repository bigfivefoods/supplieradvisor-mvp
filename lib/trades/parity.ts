/**
 * GymAdvisor feature → TradeAdvisor® feature. Used by the pull request
 * and by lib/trades/parity checks. Status is shipped when the trade
 * screen or route exists in this change.
 */
export type ParityRow = {
  gym: string;
  trade: string;
  status: 'shipped' | 'not_applicable';
  where: string;
};

export const GYM_TRADE_PARITY: ParityRow[] = [
  { gym: 'Command', trade: 'Command', status: 'shipped', where: '/dashboard/tradegraph' },
  { gym: 'Coaches', trade: 'Team', status: 'shipped', where: '/dashboard/tradegraph/team' },
  { gym: 'Clients', trade: 'Customers and sites', status: 'shipped', where: '/dashboard/tradegraph/customers' },
  { gym: 'Classes', trade: 'Price book and quote templates', status: 'shipped', where: '/dashboard/tradegraph/quote' },
  { gym: 'Movements', trade: 'Job checklists', status: 'shipped', where: '/dashboard/tradegraph/gantt' },
  { gym: 'Programmes', trade: 'Gantt plan vs actual', status: 'shipped', where: '/dashboard/tradegraph/gantt' },
  { gym: 'Leadership / leaderboard', trade: 'Quote win rate and job profit', status: 'shipped', where: '/dashboard/tradegraph/reports' },
  { gym: 'Calendar', trade: 'Day, week, month and team lanes', status: 'shipped', where: '/dashboard/tradegraph/calendar' },
  { gym: 'Coach calendar', trade: 'Technician diary', status: 'shipped', where: '/crew/tradegraph/crew_lerato' },
  { gym: 'Rooms', trade: 'Sites', status: 'shipped', where: '/dashboard/tradegraph/sites' },
  { gym: 'Plan / bookings', trade: 'Dispatch and booking requests', status: 'shipped', where: '/dashboard/tradegraph/calendar' },
  { gym: 'Check-ins', trade: 'Site arrival', status: 'shipped', where: '/dashboard/tradegraph/arrival' },
  { gym: 'Tasks', trade: 'Tasks', status: 'shipped', where: '/dashboard/tradegraph/tasks' },
  { gym: 'Messages', trade: 'Customer messages', status: 'shipped', where: '/dashboard/tradegraph/messages' },
  { gym: 'Accounts', trade: 'Invoices, statements, Paystack', status: 'shipped', where: '/dashboard/tradegraph/invoices' },
  { gym: 'Comms', trade: 'Notices', status: 'shipped', where: '/dashboard/tradegraph/notices' },
  { gym: 'Website / apps', trade: 'Brand, embed, customer app', status: 'shipped', where: '/dashboard/tradegraph/website' },
  { gym: 'Reports', trade: 'Revenue, outstanding, profit', status: 'shipped', where: '/dashboard/tradegraph/reports' },
  { gym: 'Feedback', trade: 'Reviews', status: 'shipped', where: '/dashboard/tradegraph/reviews' },
  { gym: 'Care', trade: 'Follow-up tasks', status: 'shipped', where: '/dashboard/tradegraph/tasks' },
  { gym: 'Member PWA', trade: 'Client PWA', status: 'shipped', where: '/customer/tradegraph/demo' },
  { gym: 'Coach PWA', trade: 'Technician PWA', status: 'shipped', where: '/crew/tradegraph/crew_lerato' },
  { gym: 'Owner workspace', trade: 'Owner PWA', status: 'shipped', where: '/work/tradegraph' },
  { gym: 'Join', trade: 'Join', status: 'shipped', where: '/join/tradegraph' },
  { gym: 'ICS calendar', trade: 'ICS download', status: 'shipped', where: '/api/public/tradegraph/ics?token=demo' },
  { gym: 'Google Calendar OAuth', trade: 'ICS file (GymAdvisor does not use live Google OAuth)', status: 'not_applicable', where: 'buildTradeIcs' },
  { gym: 'Embed', trade: 'Booking embed', status: 'shipped', where: '/embed/tradegraph/demo' },
  { gym: 'Garmin / wearables', trade: 'Not a trade workflow', status: 'not_applicable', where: '' },
  { gym: 'Class subscriptions', trade: 'Deposits and progress invoices', status: 'shipped', where: '/dashboard/tradegraph/invoices' },
];
