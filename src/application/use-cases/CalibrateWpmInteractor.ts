import { ReadingTimeCalculator } from "../../domain/services/ReadingTimeCalculator";
import { WpmSpeed } from "../../domain/value-objects/WpmSpeed";
import { UserRepositoryPort } from "../../ports/driven/UserRepositoryPort";
import {
  CalibrateWpmInput,
  CalibrateWpmOutput,
  CalibrateWpmUseCase,
} from "../../ports/driving/CalibrateWpmUseCase";
import { logger } from "../../shared/logger";

export class CalibrateWpmInteractor implements CalibrateWpmUseCase {
  constructor(private readonly userRepo: UserRepositoryPort) {}

  async execute(input: CalibrateWpmInput): Promise<CalibrateWpmOutput> {
    const { correlationId } = input;
    logger.info({ correlationId }, "CalibrateWpmInteractor.execute - started");

    try {
      const user = await this.userRepo.findById(input.userId);
      const previousWpm = user.wpmSpeed.value;

      const wpmValue = ReadingTimeCalculator.estimateWpm(
        input.wordsRead,
        input.elapsedSeconds,
      );
      const newWpm = WpmSpeed.create(
        wpmValue,
        new Date(),
        (user.wpmSpeed.sampleCount ?? 0) + 1,
      );
      const updatedUser = user.withUpdatedWpm(newWpm);
      await this.userRepo.save(updatedUser);

      logger.info(
        { correlationId },
        `CalibrateWpmInteractor.execute - wpm updated from ${previousWpm} to ${newWpm.value} - correlation_id: ${correlationId}`,
      );

      return {
        wpm: newWpm.value,
        sampleCount: newWpm.sampleCount,
        calibratedAt: newWpm.calibratedAt,
      };
    } catch (err) {
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "CalibrateWpmInteractor.execute - error occurred",
      );
      throw err;
    }
  }
}
