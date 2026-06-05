import { SessionRepositoryPort } from "../../ports/driven/SessionRepositoryPort";
import {
  GetSessionInput,
  GetSessionOutput,
  GetSessionUseCase,
} from "../../ports/driving/GetSessionUseCase";
import { logger } from "../../shared/logger";

export class GetSessionInteractor implements GetSessionUseCase {
  constructor(private readonly sessionRepo: SessionRepositoryPort) {}

  async execute(input: GetSessionInput): Promise<GetSessionOutput> {
    const { correlationId, sessionId } = input;
    logger.info(
      { correlationId, sessionId },
      "GetSessionInteractor.execute - started",
    );

    try {
      const session = await this.sessionRepo.findById(sessionId);

      const output: GetSessionOutput = {
        sessionId: session.id,
        userId: session.userId,
        bookTitle: session.bookTitle,
        chapterNumber: session.chapterNumber,
        chapterTitle: session.chapterTitle,
        mode: session.mode,
        estimatedDurationMinutes: session.estimatedDurationMinutes,
        status: session.status,
        spotifyPlaylistUrl: session.playlist.spotifyPlaylistUrl,
        playlistName: session.playlist.name,
        tracks: session.playlist.tracks,
        createdAt: session.createdAt.toISOString(),
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        pausedAt: session.pausedAt?.toISOString() ?? null,
        totalPausedSeconds: session.totalPausedSeconds,
      };

      logger.info(
        { correlationId, sessionId },
        "GetSessionInteractor.execute - completed",
      );
      return output;
    } catch (err) {
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "GetSessionInteractor.execute - error occurred",
      );
      throw err;
    }
  }
}
