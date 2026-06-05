export interface GetAuthUrlInput {
  readonly userId: string;
  readonly correlationId: string;
}

export interface GetAuthUrlOutput {
  readonly authUrl: string;
  readonly codeVerifier: string;
}

export interface ExchangeCodeInput {
  readonly code: string;
  readonly state: string;
  readonly correlationId: string;
}

export interface ExchangeCodeOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface RefreshTokenInput {
  readonly userId: string;
  readonly refreshToken: string;
  readonly correlationId: string;
}

export interface RefreshTokenOutput {
  readonly accessToken: string;
  readonly expiresIn: number;
}

export interface SpotifyAuthUseCase {
  getAuthorizationUrl(input: GetAuthUrlInput): GetAuthUrlOutput;
  exchangeCode(input: ExchangeCodeInput): Promise<ExchangeCodeOutput>;
  refreshToken(input: RefreshTokenInput): Promise<RefreshTokenOutput>;
}
