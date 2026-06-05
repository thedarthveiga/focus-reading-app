export interface CalibrateWpmInput {
  readonly userId: string;
  readonly wordsRead: number;
  readonly elapsedSeconds: number;
  readonly correlationId: string;
}

export interface CalibrateWpmOutput {
  readonly wpm: number;
  readonly sampleCount: number;
  readonly calibratedAt: Date;
}

export interface CalibrateWpmUseCase {
  execute(input: CalibrateWpmInput): Promise<CalibrateWpmOutput>;
}
