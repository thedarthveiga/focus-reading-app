import { InvalidValueError } from '../errors/DomainError';

export class ReadingDuration {
  private constructor(readonly inMinutes: number) {}

  static fromMinutes(minutes: number): ReadingDuration {
    if (minutes <= 0) {
      throw new InvalidValueError('duration', 'must be greater than 0');
    }
    return new ReadingDuration(Math.ceil(minutes));
  }

  static fromSeconds(seconds: number): ReadingDuration {
    return ReadingDuration.fromMinutes(seconds / 60);
  }

  get inSeconds(): number {
    return this.inMinutes * 60;
  }

  /** Rounded to nearest 5-minute block for playlist matching */
  get roundedForPlaylist(): number {
    return Math.ceil(this.inMinutes / 5) * 5;
  }

  toString(): string {
    const h = Math.floor(this.inMinutes / 60);
    const m = this.inMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
