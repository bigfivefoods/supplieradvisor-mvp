import { supabase } from './supabase';

type LinkedAccountLike = {
  type?: string;
  address?: string | null;
};

type PrivyUserLike = {
  id?: string | null;
  linkedAccounts?: LinkedAccountLike[] | null;
  linked_accounts?: LinkedAccountLike[] | null;
};

export interface AssociatedBusiness {
  id: string;
  user_id?: string | null;
  legal_name?: string | null;
  trading_name?: string | null;
  business_type?: string | null;
  city?: string | null;
  province?: string | null;
  logo_url?: string | null;
  updated_at?: string | null;
}

function uniqueTrimmedStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map(value => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

/**
 * Privy user ids may be prefixed before they are stored in Supabase-facing tables.
 * Strip the transport prefix so we always use the canonical auth uid as the primary key.
 */
export function getPrimarySupabaseUid(user: PrivyUserLike | null | undefined) {
  return (user?.id || '').replace(/^privy:/, '').trim();
}

export function getWalletLinkIds(user: PrivyUserLike | null | undefined) {
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts ?? [];

  return uniqueTrimmedStrings(
    linkedAccounts.flatMap(account => {
      if ((account?.type !== 'wallet' && account?.type !== 'smart_wallet') || !account.address) {
        return [];
      }

      return [account.address, account.address.toLowerCase()];
    })
  );
}

export function getAssociatedUserIds(user: PrivyUserLike | null | undefined) {
  return uniqueTrimmedStrings([getPrimarySupabaseUid(user), user?.id || '', ...getWalletLinkIds(user)]);
}

export async function getAssociatedBusinesses(user: PrivyUserLike | null | undefined) {
  const candidateUserIds = getAssociatedUserIds(user);
  const primaryUserId = getPrimarySupabaseUid(user);

  if (!primaryUserId || candidateUserIds.length === 0) {
    return { primaryUserId, businesses: [] as AssociatedBusiness[] };
  }

  const { data: directProfiles, error: directProfilesError } = await supabase
    .from('profiles')
    .select('id, user_id, legal_name, trading_name, business_type, city, province, logo_url, updated_at')
    .in('user_id', candidateUserIds);

  if (directProfilesError) {
    throw directProfilesError;
  }

  const { data: businessLinks, error: businessLinksError } = await supabase
    .from('business_users')
    .select('profile_id')
    .in('user_id', candidateUserIds);

  if (businessLinksError) {
    throw businessLinksError;
  }

  const linkedProfileIds = uniqueTrimmedStrings((businessLinks || []).map(link => link.profile_id));
  let linkedProfiles: AssociatedBusiness[] = [];

  if (linkedProfileIds.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, legal_name, trading_name, business_type, city, province, logo_url, updated_at')
      .in('id', linkedProfileIds);

    if (error) {
      throw error;
    }

    linkedProfiles = (data || []) as AssociatedBusiness[];
  }

  const businessesById = new Map<string, AssociatedBusiness>();

  [...((directProfiles || []) as AssociatedBusiness[]), ...linkedProfiles].forEach(profile => {
    if (profile?.id) {
      businessesById.set(profile.id, profile);
    }
  });

  const businesses = Array.from(businessesById.values()).sort((left, right) => {
    const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
    const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return (left.trading_name || left.legal_name || '').localeCompare(right.trading_name || right.legal_name || '');
  });

  return { primaryUserId, businesses };
}
