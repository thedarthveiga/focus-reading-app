import { TrackSuggestion } from "./TrackSuggestion";

export interface GeneratedPlaylist {
  readonly spotifyPlaylistId: string;
  readonly spotifyPlaylistUrl: string;
  readonly name: string;
  readonly tracks: readonly TrackSuggestion[];
  readonly durationMinutes: number;
}
