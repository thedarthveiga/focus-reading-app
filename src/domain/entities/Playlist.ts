import { InvalidValueError } from '../errors/DomainError';

import { ChapterMood } from './Book';

export const FOCUS_TYPES = ['alpha-waves', 'ambient', 'binaural-beats'] as const;
export type FocusType = (typeof FOCUS_TYPES)[number];

/** Maps chapter mood to the best focus type for neurological immersion */
export const MOOD_TO_FOCUS_MAP: Record<ChapterMood, FocusType> = {
  reflective: 'alpha-waves',
  calm: 'alpha-waves',
  tense: 'binaural-beats',
  action: 'ambient',
};

export class Playlist {
  private constructor(
    readonly id: string,
    readonly spotifyPlaylistId: string,
    readonly focusType: FocusType,
    readonly durationMinutes: number,
    readonly name: string,
  ) {}

  static create(
    id: string,
    spotifyPlaylistId: string,
    focusType: FocusType,
    durationMinutes: number,
    name: string,
  ): Playlist {
    if (!spotifyPlaylistId || spotifyPlaylistId.trim().length === 0) {
      throw new InvalidValueError('spotifyPlaylistId', 'must not be empty');
    }
    if (durationMinutes <= 0) {
      throw new InvalidValueError('durationMinutes', 'must be greater than 0');
    }
    return new Playlist(id, spotifyPlaylistId.trim(), focusType, durationMinutes, name.trim());
  }

  coversSession(sessionDurationMinutes: number): boolean {
    return this.durationMinutes >= sessionDurationMinutes;
  }
}
