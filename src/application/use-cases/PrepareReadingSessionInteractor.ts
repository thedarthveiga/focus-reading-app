import { ReadingSession } from "../../domain/entities/ReadingSession";
import { ExternalServiceError } from "../../domain/errors/DomainError";
import { ReadingTimeCalculator } from "../../domain/services/ReadingTimeCalculator";
import { AIPlaylistComposerPort } from "../../ports/driven/AIPlaylistComposerPort";
import { IdGeneratorPort } from "../../ports/driven/IdGeneratorPort";
import { SessionRepositoryPort } from "../../ports/driven/SessionRepositoryPort";
import { SpotifyMusicPort } from "../../ports/driven/SpotifyMusicPort";
import { UserRepositoryPort } from "../../ports/driven/UserRepositoryPort";
import {
  PrepareReadingSessionUseCase,
  PrepareSessionInput,
  PrepareSessionOutput,
} from "../../ports/driving/PrepareReadingSessionUseCase";
import { logger } from "../../shared/logger";

export class PrepareReadingSessionInteractor implements PrepareReadingSessionUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly sessionRepo: SessionRepositoryPort,
    private readonly aiComposer: AIPlaylistComposerPort,
    private readonly spotifyMusic: SpotifyMusicPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: PrepareSessionInput): Promise<PrepareSessionOutput> {
    const { correlationId } = input;
    logger.info(
      { correlationId },
      "PrepareReadingSessionInteractor.execute - started",
    );

    try {
      const user = await this.userRepo.findById(input.userId);

      if (!user.hasValidSpotifyToken()) {
        throw new ExternalServiceError(
          "Spotify",
          "User has no valid Spotify access token. Please authenticate first.",
        );
      }

      const wordCount = await this.aiComposer.estimateWordCount({
        bookTitle: input.bookTitle,
        chapterNumber: input.chapterNumber,
        chapterTitle: input.chapterTitle,
        correlationId,
      });
      logger.debug(
        { correlationId, wordCount },
        "PrepareReadingSessionInteractor.execute - word count estimated",
      );

      const duration = ReadingTimeCalculator.calculate(
        wordCount,
        user.wpmSpeed,
      );

      const composed = await this.aiComposer.composePlaylist({
        bookTitle: input.bookTitle,
        chapterNumber: input.chapterNumber,
        chapterTitle: input.chapterTitle,
        mode: input.mode,
        estimatedDurationMinutes: duration.inMinutes,
        correlationId,
      });
      logger.debug(
        { correlationId, trackCount: composed.tracks.length },
        "PrepareReadingSessionInteractor.execute - playlist composed",
      );

      const trackIds: string[] = [];
      for (const track of composed.tracks) {
        const id = await this.spotifyMusic.searchTrack(
          track.title,
          track.artist,
          correlationId,
        );
        if (id) trackIds.push(id);
      }
      logger.debug(
        {
          correlationId,
          found: trackIds.length,
          total: composed.tracks.length,
        },
        "PrepareReadingSessionInteractor.execute - tracks searched",
      );

      const playlist = await this.spotifyMusic.createPlaylist(
        user.id,
        composed.playlistName,
        trackIds,
        user.spotifyAccessToken!,
        correlationId,
      );

      const session = ReadingSession.prepare(
        this.idGenerator.generate(),
        user.id,
        input.bookTitle,
        input.chapterNumber,
        input.chapterTitle,
        input.mode,
        duration.inMinutes,
        playlist,
      );

      await this.sessionRepo.save(session);

      const output: PrepareSessionOutput = {
        sessionId: session.id,
        estimatedMinutes: session.estimatedDurationMinutes,
        spotifyPlaylistUrl: session.playlist.spotifyPlaylistUrl,
        playlistName: session.playlist.name,
      };

      logger.info(
        { correlationId, sessionId: session.id },
        "PrepareReadingSessionInteractor.execute - completed",
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
        "PrepareReadingSessionInteractor.execute - error occurred",
      );
      throw err;
    }
  }
}
