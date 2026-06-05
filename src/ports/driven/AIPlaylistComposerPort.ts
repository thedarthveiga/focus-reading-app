import { ReadingMode } from "../../domain/value-objects/ReadingMode";
import { TrackSuggestion } from "../../domain/value-objects/TrackSuggestion";

export interface WordCountInput {
  readonly bookTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle?: string;
  readonly correlationId: string;
}

export interface ComposePlaylistInput {
  readonly bookTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle?: string;
  readonly mode: ReadingMode;
  readonly estimatedDurationMinutes: number;
  readonly correlationId: string;
}

export interface ComposePlaylistOutput {
  readonly playlistName: string;
  readonly tracks: TrackSuggestion[];
}

export interface AIPlaylistComposerPort {
  estimateWordCount(input: WordCountInput): Promise<number>;
  composePlaylist(input: ComposePlaylistInput): Promise<ComposePlaylistOutput>;
}
