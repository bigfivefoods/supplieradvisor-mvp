/**
 * One wallet account per company. Advisor desks stay as cards under it.
 */

export type WalletCard = {
  id?: string;
  kind: string;
  kind_label?: string;
  company_id: number;
  company_name: string;
  brand?: string | null;
  portal_path: string;
  portal_token?: string | null;
  checkin_path?: string | null;
  ref_label?: string | null;
  capabilities?: string[];
};

export type WalletAccount<T extends WalletCard = WalletCard> = {
  company_id: number;
  brand: string;
  cards: T[];
  kinds: string[];
};

export function groupWalletAccounts<T extends WalletCard>(
  memberships: T[]
): WalletAccount<T>[] {
  const map = new Map<number, T[]>();
  for (const m of memberships) {
    if (!m || !Number.isFinite(Number(m.company_id))) continue;
    const id = Number(m.company_id);
    const list = map.get(id) || [];
    list.push(m);
    map.set(id, list);
  }
  return [...map.entries()].map(([company_id, cards]) => {
    const named = cards.find((c) => c.kind !== 'account') || cards[0];
    return {
      company_id,
      brand: String(named?.brand || named?.company_name || `Company #${company_id}`),
      cards,
      kinds: [...new Set(cards.map((c) => c.kind))],
    };
  });
}

export function primaryPortal<T extends WalletCard>(
  account: WalletAccount<T>
): string {
  const pref =
    account.cards.find((c) => c.kind !== 'account' && c.portal_path) ||
    account.cards[0];
  return pref?.portal_path || `/c/${account.company_id}`;
}

export function shopHref(companyId: number): string {
  return `/c/${companyId}`;
}
