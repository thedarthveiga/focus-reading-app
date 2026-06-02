/**
 * Single-table key builders.
 * All key construction is centralised here — never inline strings elsewhere.
 */
export const Keys = {
  user: {
    pk: (id: string): string => `USER#${id}`,
    sk: (): string => "#METADATA",
  },
  book: {
    pk: (id: string): string => `BOOK#${id}`,
    sk: (): string => "#METADATA",
    chapterSk: (number: number): string =>
      `CHAPTER#${String(number).padStart(3, "0")}`,
    chapterPrefix: (): string => "CHAPTER#",
  },
  session: {
    pk: (id: string): string => `SESSION#${id}`,
    sk: (): string => "#METADATA",
    userSessionSk: (sessionId: string): string => `SESSION#${sessionId}`,
  },
  gsi1: {
    bookTitlePk: (): string => "BOOK_TITLE",
    bookTitleSk: (title: string): string => title.toLowerCase().trim(),
  },
} as const;

export const GSI1_INDEX = "GSI1";
