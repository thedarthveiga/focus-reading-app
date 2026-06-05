import { TrackSuggestion } from "../../domain/value-objects/TrackSuggestion";

export interface GetSessionInput {
  readonly sessionId: string;
  readonly correlationId: string;
}

export interface GetSessionOutput {
  readonly sessionId: string;
  readonly userId: string;
  readonly bookTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string | undefined;
  readonly mode: string;
  readonly estimatedDurationMinutes: number;
  readonly status: string;
  readonly spotifyPlaylistUrl: string;
  readonly playlistName: string;
  readonly tracks: readonly TrackSuggestion[];
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly pausedAt: string | null;
  readonly totalPausedSeconds: number;
}

export interface GetSessionUseCase {
  execute(input: GetSessionInput): Promise<GetSessionOutput>;
}
