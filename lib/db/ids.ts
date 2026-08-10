// Sortable, collision-resistant id: millisecond timestamp (base36, zero-padded so it
// sorts lexicographically the same as numerically) + a random suffix from crypto.
// Replaces `'w_' + Date.now() + Math.random().toString(36).substr(2,4)` (deprecated
// `substr`, ~1.7M keyspace) used across the old codebase — see
// docs/progress/00-baseline-audit.md #112.
export function newId(prefix = ''): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${time}${random}`;
}
