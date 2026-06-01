import { ChapterMood } from '../../domain/entities/Book';
import { Playlist } from '../../domain/entities/Playlist';

export interface PlaylistSearchCriteria {
  readonly durationMinutes: number;
  readonly chapterMood: ChapterMood;
}

export interface SpotifyServicePort {
  findPlaylistFor(criteria: PlaylistSearchCriteria): Promise<Playlist>;
}
