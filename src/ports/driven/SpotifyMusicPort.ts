import { GeneratedPlaylist } from "../../domain/value-objects/GeneratedPlaylist";

export interface SpotifyMusicPort {
  searchTrack(
    title: string,
    artist: string,
    correlationId: string,
  ): Promise<string | null>;
  createPlaylist(
    userId: string,
    name: string,
    trackIds: string[],
    accessToken: string,
    correlationId: string,
  ): Promise<GeneratedPlaylist>;
  startPlayback(
    userId: string,
    playlistId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<void>;
}
