import { ChapterMood } from '../../../domain/entities/Book';
import { MOOD_TO_FOCUS_MAP, Playlist } from '../../../domain/entities/Playlist';
import { DomainError } from '../../../domain/errors/DomainError';
import { PlaylistSearchCriteria, SpotifyServicePort } from '../../../ports/driven/SpotifyServicePort';

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyPlaylistItem {
  id: string;
  name: string;
  tracks: { total: number };
}

interface SpotifySearchResponse {
  playlists: { items: SpotifyPlaylistItem[] };
}

/** Mood-to-Spotify-search-query mapping for focus-inducing playlists */
const MOOD_QUERIES: Record<ChapterMood, string> = {
  reflective: 'alpha waves focus deep reading',
  calm: 'alpha waves ambient study',
  tense: 'binaural beats focus thriller',
  action: 'ambient electronic focus',
};

export class SpotifyApiAdapter implements SpotifyServicePort {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly baseUrl = 'https://api.spotify.com/v1',
  ) {}

  async findPlaylistFor(criteria: PlaylistSearchCriteria): Promise<Playlist> {
    const token = await this.getAccessToken();
    const query = MOOD_QUERIES[criteria.chapterMood];

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&type=playlist&limit=10`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new DomainError(`Spotify API error: ${res.status}`, 'SPOTIFY_API_ERROR');
    }

    const data = (await res.json()) as SpotifySearchResponse;
    const items = data.playlists?.items ?? [];

    if (items.length === 0) {
      throw new DomainError('No playlist found for the given criteria', 'PLAYLIST_NOT_FOUND');
    }

    // Pick the first playlist — future: rank by duration match
    const item = items[0];
    const focusType = MOOD_TO_FOCUS_MAP[criteria.chapterMood];

    return Playlist.create(
      `spotify-${item.id}`,
      item.id,
      focusType,
      criteria.durationMinutes,
      item.name,
    );
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new DomainError('Failed to obtain Spotify access token', 'SPOTIFY_AUTH_ERROR');
    }

    const data = (await res.json()) as SpotifyTokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s safety margin

    return this.cachedToken;
  }
}
