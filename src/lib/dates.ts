/** Whole days remaining until `purgeAtIso`, floored at 0. */
export function daysUntil(purgeAtIso: string): number {
  const ms = new Date(purgeAtIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
