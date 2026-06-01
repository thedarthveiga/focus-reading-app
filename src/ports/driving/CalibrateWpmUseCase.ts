import { WpmSpeed } from '../../domain/value-objects/WpmSpeed';

export interface CalibrateWpmInput {
  readonly userId: string;
  readonly wordsRead: number;
  readonly elapsedSeconds: number;
}

export interface CalibrateWpmUseCase {
  execute(input: CalibrateWpmInput): Promise<WpmSpeed>;
}
