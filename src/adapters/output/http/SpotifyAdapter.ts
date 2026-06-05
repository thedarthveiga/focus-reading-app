import { ExternalServiceError } from "../../../domain/errors/DomainError";
import { GeneratedPlaylist } from "../../../domain/value-objects/GeneratedPlaylist";
import {
  SpotifyAuthPort,
  SpotifyTokens,
} from "../../../ports/driven/SpotifyAuthPort";
import { SpotifyMusicPort } from "../../../ports/driven/SpotifyMusicPort";
import { logger } from "../../../shared/logger";

interface ClientCredentialsResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyTrackItem {
  id: string;
}

interface SpotifySearchResponse {
  tracks: { items: SpotifyTrackItem[] };
}

interface SpotifyPlaylistResponse {
  id: string;
  external_urls: { spotify: string };
}

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class SpotifyAdapter implements SpotifyAuthPort, SpotifyMusicPort {
  private clientCredentialsToken: string | null = null;
  private clientCredentialsExpiresAt: number = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly baseUrl = "https://api.spotify.com/v1",
    private readonly accountsUrl = "https://accounts.spotify.com",
  ) {}

  // ── SpotifyAuthPort ────────────────────────────────────────────────────────

  getAuthorizationUrl(codeChallenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      state,
      scope:
        "playlist-modify-public playlist-modify-private user-modify-playback-state",
    });
    return `${this.accountsUrl}/authorize?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
    correlationId: string,
  ): Promise<SpotifyTokens> {
    logger.info(
      { correlationId },
      "SpotifyAdapter.exchangeCode - calling Spotify API",
    );

    const res = await fetch(`${this.accountsUrl}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError(
        "Spotify",
        `Token exchange failed: ${res.status}`,
      );
    }

    const data = (await res.json()) as SpotifyTokenResponse;
    logger.info(
      { correlationId },
      "SpotifyAdapter.exchangeCode - tokens received",
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshToken(
    refreshToken: string,
    correlationId: string,
  ): Promise<SpotifyTokens> {
    logger.info(
      { correlationId },
      "SpotifyAdapter.refreshToken - calling Spotify API",
    );

    const res = await fetch(`${this.accountsUrl}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError(
        "Spotify",
        `Token refresh failed: ${res.status}`,
      );
    }

    const data = (await res.json()) as SpotifyTokenResponse;
    logger.info(
      { correlationId },
      "SpotifyAdapter.refreshToken - tokens refreshed",
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    };
  }

  // ── SpotifyMusicPort ───────────────────────────────────────────────────────

  async searchTrack(
    title: string,
    artist: string,
    correlationId: string,
  ): Promise<string | null> {
    logger.info(
      { correlationId },
      "SpotifyAdapter.searchTrack - calling Spotify API",
    );

    try {
      const token = await this.getClientCredentialsToken(correlationId);
      const query = encodeURIComponent(`track:${title} artist:${artist}`);
      const res = await fetch(
        `${this.baseUrl}/search?q=${query}&type=track&limit=1`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        logger.warn(
          { correlationId },
          `SpotifyAdapter.searchTrack - search failed: ${res.status}`,
        );
        return null;
      }

      const data = (await res.json()) as SpotifySearchResponse;
      const trackId = data.tracks?.items?.[0]?.id ?? null;
      logger.info(
        { correlationId, found: trackId !== null },
        "SpotifyAdapter.searchTrack - completed",
      );
      return trackId;
    } catch (err) {
      logger.warn(
        { correlationId, error: (err as Error).message },
        "SpotifyAdapter.searchTrack - error, returning null",
      );
      return null;
    }
  }

  async createPlaylist(
    userId: string,
    name: string,
    trackIds: string[],
    accessToken: string,
    correlationId: string,
  ): Promise<GeneratedPlaylist> {
    logger.info(
      { correlationId },
      "SpotifyAdapter.createPlaylist - calling Spotify API",
    );

    const createRes = await fetch(`${this.baseUrl}/users/${userId}/playlists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        public: false,
        description: "Generated by Focus Reading App",
      }),
    });

    if (!createRes.ok) {
      throw new ExternalServiceError(
        "Spotify",
        `Failed to create playlist: ${createRes.status}`,
      );
    }

    const playlist = (await createRes.json()) as SpotifyPlaylistResponse;

    if (trackIds.length > 0) {
      const addRes = await fetch(
        `${this.baseUrl}/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: trackIds.map((id) => `spotify:track:${id}`),
          }),
        },
      );
      if (!addRes.ok) {
        logger.warn(
          { correlationId },
          `SpotifyAdapter.createPlaylist - failed to add tracks: ${addRes.status}`,
        );
      }
    }

    logger.info(
      { correlationId, playlistId: playlist.id },
      "SpotifyAdapter.createPlaylist - playlist created",
    );
    return {
      spotifyPlaylistId: playlist.id,
      spotifyPlaylistUrl: playlist.external_urls.spotify,
      name,
      tracks: trackIds.map((id) => ({
        spotifyTrackId: id,
        title: "",
        artist: "",
      })),
      durationMinutes: 0,
    };
  }

  async startPlayback(
    userId: string,
    playlistId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<void> {
    logger.info(
      { correlationId },
      "SpotifyAdapter.startPlayback - calling Spotify API",
    );
    void userId;

    const res = await fetch(`${this.baseUrl}/me/player/play`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
    });

    if (!res.ok && res.status !== 204) {
      throw new ExternalServiceError(
        "Spotify",
        `Failed to start playback: ${res.status}`,
      );
    }

    logger.info(
      { correlationId },
      "SpotifyAdapter.startPlayback - playback started",
    );
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async getClientCredentialsToken(
    correlationId: string,
  ): Promise<string> {
    if (
      this.clientCredentialsToken &&
      Date.now() < this.clientCredentialsExpiresAt
    ) {
      return this.clientCredentialsToken;
    }

    logger.info(
      { correlationId },
      "SpotifyAdapter.getClientCredentialsToken - calling Spotify API",
    );
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");
    const res = await fetch(`${this.accountsUrl}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new ExternalServiceError(
        "Spotify",
        "Failed to obtain client credentials token",
      );
    }

    const data = (await res.json()) as ClientCredentialsResponse;
    this.clientCredentialsToken = data.access_token;
    this.clientCredentialsExpiresAt =
      Date.now() + (data.expires_in - 60) * 1000;
    logger.info(
      { correlationId },
      "SpotifyAdapter.getClientCredentialsToken - token obtained",
    );
    return this.clientCredentialsToken;
  }
}
