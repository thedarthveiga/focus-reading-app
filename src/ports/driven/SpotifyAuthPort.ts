export interface SpotifyTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface SpotifyAuthPort {
  getAuthorizationUrl(codeChallenge: string, state: string): string;
  exchangeCode(
    code: string,
    codeVerifier: string,
    correlationId: string,
  ): Promise<SpotifyTokens>;
  refreshToken(
    refreshToken: string,
    correlationId: string,
  ): Promise<SpotifyTokens>;
}
