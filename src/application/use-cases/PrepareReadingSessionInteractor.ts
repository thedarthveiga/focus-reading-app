import { ReadingSession } from "../../domain/entities/ReadingSession";
import { ReadingTimeCalculator } from "../../domain/services/ReadingTimeCalculator";
import { BookRepositoryPort } from "../../ports/driven/BookRepositoryPort";
import { IdGeneratorPort } from "../../ports/driven/IdGeneratorPort";
import { SpotifyServicePort } from "../../ports/driven/SpotifyServicePort";
import { UserRepositoryPort } from "../../ports/driven/UserRepositoryPort";
import {
  PrepareReadingSessionUseCase,
  PrepareSessionInput,
  PrepareSessionOutput,
} from "../../ports/driving/PrepareReadingSessionUseCase";

export class PrepareReadingSessionInteractor implements PrepareReadingSessionUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly bookRepo: BookRepositoryPort,
    private readonly spotifyService: SpotifyServicePort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: PrepareSessionInput): Promise<PrepareSessionOutput> {
    // Fetch user and book in parallel — no dependency between them
    const [user, book] = await Promise.all([
      this.userRepo.findById(input.userId),
      this.bookRepo.findById(input.bookId),
    ]);

    // Business rule: validate chapter exists (throws EntityNotFoundError if not)
    const chapter = book.getChapter(input.chapterNumber);

    // Pure domain calculation — no I/O
    const duration = ReadingTimeCalculator.calculate(
      chapter.wordCount,
      user.wpmSpeed,
    );

    // Fetch matching Spotify playlist via driven port
    const playlist = await this.spotifyService.findPlaylistFor({
      durationMinutes: duration.roundedForPlaylist,
      chapterMood: chapter.mood,
    });

    // Create the aggregate — business rules enforced inside the entity
    const session = ReadingSession.prepare(
      this.idGenerator.generate(),
      user.id,
      book.id,
      input.chapterNumber,
      duration.inMinutes,
      playlist,
    );

    // Return DTO — no domain entity leaks outside the use case
    return {
      sessionId: session.id,
      estimatedMinutes: session.estimatedDurationMinutes,
      spotifyPlaylistId: session.playlist.spotifyPlaylistId,
      focusType: session.playlist.focusType,
      chapterTitle: chapter.title,
    };
  }
}
