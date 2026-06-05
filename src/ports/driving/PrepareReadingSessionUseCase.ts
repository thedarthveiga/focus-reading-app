import { ReadingMode } from "../../domain/value-objects/ReadingMode";

export interface PrepareSessionInput {
  readonly userId: string;
  readonly bookTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle?: string;
  readonly mode: ReadingMode;
  readonly correlationId: string;
}

export interface PrepareSessionOutput {
  readonly sessionId: string;
  readonly estimatedMinutes: number;
  readonly spotifyPlaylistUrl: string;
  readonly playlistName: string;
}

export interface PrepareReadingSessionUseCase {
  execute(input: PrepareSessionInput): Promise<PrepareSessionOutput>;
}
