/**
 * lib/uuid.ts — tiny wrapper so we never spread crypto.randomUUID() across the codebase.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
