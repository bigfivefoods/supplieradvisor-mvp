import { TEAM_ROLE_OPTIONS, normalizeTeamRole, type TeamRole } from '@/lib/business/permissions';

export type TeamRoleGroup<T> = {
  role: TeamRole;
  label: string;
  rights: string;
  members: T[];
};

function memberSortName(member: {
  name?: string | null;
  email?: string | null;
  invited_email?: string | null;
}): string {
  return String(member.name || member.email || member.invited_email || '')
    .trim()
    .toLowerCase();
}

/** Listed members, one section per role, in the team-role catalogue order. Empty roles are omitted. */
export function groupTeamMembersByRole<
  T extends {
    role?: string | null;
    name?: string | null;
    email?: string | null;
    invited_email?: string | null;
  },
>(members: T[]): TeamRoleGroup<T>[] {
  const buckets = new Map<TeamRole, T[]>();
  for (const opt of TEAM_ROLE_OPTIONS) buckets.set(opt.value, []);

  for (const member of members) {
    const role = normalizeTeamRole(member.role);
    const bucket = buckets.get(role);
    if (bucket) bucket.push(member);
  }

  return TEAM_ROLE_OPTIONS.map((opt) => {
    const list = buckets.get(opt.value) || [];
    list.sort((a, b) => memberSortName(a).localeCompare(memberSortName(b)));
    return {
      role: opt.value,
      label: opt.label,
      rights: opt.rights,
      members: list,
    };
  }).filter((group) => group.members.length > 0);
}
