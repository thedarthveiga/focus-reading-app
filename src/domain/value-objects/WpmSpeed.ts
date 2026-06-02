import { InvalidValueError } from "../errors/DomainError";

export const WPM_MIN = 100;
export const WPM_MAX = 1000;

export class WpmSpeed {
  private constructor(
    readonly value: number,
    readonly calibratedAt: Date,
    readonly sampleCount: number,
  ) {}

  static create(
    value: number,
    calibratedAt: Date,
    sampleCount: number,
  ): WpmSpeed {
    if (!Number.isInteger(value) || value < WPM_MIN || value > WPM_MAX) {
      throw new InvalidValueError(
        "wpmSpeed",
        `must be an integer between ${WPM_MIN} and ${WPM_MAX}, got ${value}`,
      );
    }
    if (sampleCount < 1) {
      throw new InvalidValueError("sampleCount", "must be at least 1");
    }
    return new WpmSpeed(value, calibratedAt, sampleCount);
  }

  /** Default speed for new users before calibration */
  static default(): WpmSpeed {
    return new WpmSpeed(200, new Date(), 0);
  }

  isCalibrated(): boolean {
    return this.sampleCount > 0;
  }

  toString(): string {
    return `${this.value} WPM`;
  }
}
