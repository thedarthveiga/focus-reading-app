import { ReadingTimeCalculator } from "../../domain/services/ReadingTimeCalculator";
import { WpmSpeed } from "../../domain/value-objects/WpmSpeed";
import { UserRepositoryPort } from "../../ports/driven/UserRepositoryPort";
import {
  CalibrateWpmInput,
  CalibrateWpmUseCase,
} from "../../ports/driving/CalibrateWpmUseCase";

export class CalibrateWpmInteractor implements CalibrateWpmUseCase {
  constructor(private readonly userRepo: UserRepositoryPort) {}

  async execute(input: CalibrateWpmInput): Promise<WpmSpeed> {
    const user = await this.userRepo.findById(input.userId);

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

    return newWpm;
  }
}
