export type GymPwaSheetKey =
  | 'session'
  | 'create'
  | 'book'
  | 'guest'
  | 'library'
  | 'movement'
  | 'programme-edit';

export function pushGymPwaSheet(
  stack: GymPwaSheetKey[],
  next: GymPwaSheetKey
): GymPwaSheetKey[] {
  const current = Array.isArray(stack) ? [...stack] : [];
  if (current[current.length - 1] === next) return current;
  return [...current, next];
}

export function popGymPwaSheet(stack: GymPwaSheetKey[]): GymPwaSheetKey[] {
  if (!Array.isArray(stack) || stack.length <= 1) return Array.isArray(stack) ? [...stack] : [];
  return stack.slice(0, -1);
}
