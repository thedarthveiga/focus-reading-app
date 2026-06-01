export interface PrepareSessionInput {
  readonly userId: string;
  readonly bookId: string;
  readonly chapterNumber: number;
}

export interface PrepareSessionOutput {
  readonly sessionId: string;
  readonly estimatedMinutes: number;
  readonly spotifyPlaylistId: string;
  readonly focusType: string;
  readonly chapterTitle: string;
}

export interface PrepareReadingSessionUseCase {
  execute(input: PrepareSessionInput): Promise<PrepareSessionOutput>;
}
