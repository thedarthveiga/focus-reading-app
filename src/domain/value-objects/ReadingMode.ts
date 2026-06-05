export const READING_MODES = ["focus", "immersion"] as const;
export type ReadingMode = (typeof READING_MODES)[number];
