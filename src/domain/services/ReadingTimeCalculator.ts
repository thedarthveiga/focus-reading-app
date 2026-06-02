import { ReadingDuration } from "../value-objects/ReadingDuration";
import { WpmSpeed } from "../value-objects/WpmSpeed";

/**
 * Pure domain service — no I/O, no side effects.
 * Applies a 15% immersion buffer to account for reflection pauses,
 * re-reading dense passages, and neurological processing time.
 */
export const IMMERSION_BUFFER_FACTOR = 1.15;

export class ReadingTimeCalculator {
  static calculate(wordCount: number, wpmSpeed: WpmSpeed): ReadingDuration {
    const rawMinutes = wordCount / wpmSpeed.value;
    const bufferedMinutes = rawMinutes * IMMERSION_BUFFER_FACTOR;
    return ReadingDuration.fromMinutes(bufferedMinutes);
  }

  /**
   * Estimate WPM from a calibration test result.
   * @param wordsRead - number of words read in the sample
   * @param elapsedSeconds - time taken to read the sample
   */
  static estimateWpm(wordsRead: number, elapsedSeconds: number): number {
    if (elapsedSeconds <= 0) return 200;
    const wpm = Math.round((wordsRead / elapsedSeconds) * 60);
    return Math.min(Math.max(wpm, 100), 1000);
  }
}
