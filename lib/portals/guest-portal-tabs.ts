/**
 * Guest customer/supplier portal navbar: grouped workspaces + Demo at the end.
 */

export type GuestPortalTab =
  | 'profile'
  | 'quotes'
  | 'orders'
  | 'otifef'
  | 'statement'
  | 'stock'
  | 'riad'
  | 'messages'
  | 'reviews'
  | 'newpo'
  | 'projects'
  | 'people'
  | 'docs'
  | 'commercial'
  | 'demo';

export type GuestPortalTabItem = { id: GuestPortalTab; label: string };
export type GuestPortalTabGroup = {
  id: string;
  align?: 'end';
  tabs: GuestPortalTabItem[];
};

export function guestPortalTabGroups(opts: {
  kind: 'customer' | 'supplier';
  profileGaps?: number;
  isHost?: boolean;
}): GuestPortalTabGroup[] {
  const gaps = opts.profileGaps || 0;
  const profile = gaps ? `Profile (${gaps})` : 'Profile';
  const demo: GuestPortalTabGroup = {
    id: 'demo',
    align: 'end',
    tabs: [{ id: 'demo', label: 'Demo' }],
  };
  if (opts.kind === 'supplier') {
    return [
      {
        id: 'account',
        tabs: [
          { id: 'profile', label: profile },
          { id: 'people', label: 'People' },
          { id: 'docs', label: 'Documents' },
        ],
      },
      {
        id: 'trade',
        tabs: [
          { id: 'orders', label: 'Purchase orders' },
          { id: 'commercial', label: 'Commercial' },
          { id: 'stock', label: 'Stock' },
        ],
      },
      {
        id: 'work',
        tabs: [
          { id: 'projects', label: 'Projects' },
          { id: 'otifef', label: 'OTIFEF' },
        ],
      },
      {
        id: 'relate',
        tabs: [
          { id: 'messages', label: 'Messages' },
          { id: 'riad', label: 'RIAD' },
          { id: 'reviews', label: 'Ratings' },
        ],
      },
      demo,
    ];
  }
  return [
    {
      id: 'account',
      tabs: [
        { id: 'profile', label: profile },
        { id: 'people', label: 'People' },
        { id: 'docs', label: 'Documents' },
      ],
    },
    {
      id: 'trade',
      tabs: [
        { id: 'quotes', label: 'Quotations' },
        { id: 'newpo', label: 'Purchase order' },
        { id: 'orders', label: 'Sales orders' },
        { id: 'commercial', label: 'Commercial' },
        { id: 'stock', label: 'Stock' },
        { id: 'statement', label: 'Statement' },
      ],
    },
    {
      id: 'work',
      tabs: [
        { id: 'projects', label: 'Projects' },
        { id: 'otifef', label: 'OTIFEF' },
      ],
    },
    {
      id: 'relate',
      tabs: [
        { id: 'messages', label: 'Messages' },
        { id: 'riad', label: 'RIAD' },
        { id: 'reviews', label: 'Ratings' },
      ],
    },
    demo,
  ];
}

export function guestPortalTabs(opts: {
  kind: 'customer' | 'supplier';
  profileGaps?: number;
  isHost?: boolean;
}): GuestPortalTabItem[] {
  return guestPortalTabGroups(opts).flatMap((g) => g.tabs);
}
