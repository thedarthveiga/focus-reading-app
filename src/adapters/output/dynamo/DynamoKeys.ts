/**
 * Single-table key builders.
 * All key construction is centralised here — never inline strings elsewhere.
 */
export const Keys = {
  user: {
    pk: (id: string): string => `USER#${id}`,
    sk: (): string => "#METADATA",
  },
  session: {
    pk: (id: string): string => `SESSION#${id}`,
    sk: (): string => "#METADATA",
    userSessionSk: (sessionId: string): string => `SESSION#${sessionId}`,
  },
  gsi1: {
    userSessionsPk: (userId: string): string => `USER#${userId}`,
  },
} as const;

export const GSI1_INDEX = "GSI1";
