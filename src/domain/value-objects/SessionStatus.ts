export const SESSION_STATUSES = [
  "pending",
  "active",
  "completed",
  "interrupted",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export function isValidSessionStatus(value: string): value is SessionStatus {
  return SESSION_STATUSES.includes(value as SessionStatus);
}
