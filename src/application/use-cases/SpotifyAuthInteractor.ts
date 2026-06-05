import { createHash, randomBytes } from "crypto";

import { ExternalServiceError } from "../../domain/errors/DomainError";
import { SpotifyAuthPort } from "../../ports/driven/SpotifyAuthPort";
import { UserRepositoryPort } from "../../ports/driven/UserRepositoryPort";
import {
  ExchangeCodeInput,
  ExchangeCodeOutput,
  GetAuthUrlInput,
  GetAuthUrlOutput,
  RefreshTokenInput,
  RefreshTokenOutput,
  SpotifyAuthUseCase,
} from "../../ports/driving/SpotifyAuthUseCase";
import { logger } from "../../shared/logger";

export class SpotifyAuthInteractor implements SpotifyAuthUseCase {
  constructor(
    private readonly spotifyAuth: SpotifyAuthPort,
    private readonly userRepo: UserRepositoryPort,
  ) {}

  getAuthorizationUrl(input: GetAuthUrlInput): GetAuthUrlOutput {
    const { correlationId, userId } = input;
    logger.info(
      { correlationId },
      "SpotifyAuthInteractor.getAuthorizationUrl - started",
    );

    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const state = Buffer.from(
      JSON.stringify({ userId, codeVerifier }),
    ).toString("base64url");

    const authUrl = this.spotifyAuth.getAuthorizationUrl(codeChallenge, state);
    logger.info(
      { correlationId },
      "SpotifyAuthInteractor.getAuthorizationUrl - completed",
    );
    return { authUrl, codeVerifier };
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<ExchangeCodeOutput> {
    const { correlationId, code, state } = input;
    logger.info(
      { correlationId },
      "SpotifyAuthInteractor.exchangeCode - started",
    );

    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8"),
      ) as {
        userId: string;
        codeVerifier: string;
      };

      const tokens = await this.spotifyAuth.exchangeCode(
        code,
        decoded.codeVerifier,
        correlationId,
      );
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      const user = await this.userRepo.findById(decoded.userId);
      const updated = user.withSpotifyTokens(
        tokens.accessToken,
        tokens.refreshToken,
        expiresAt,
      );
      await this.userRepo.save(updated);

      logger.info(
        { correlationId },
        "SpotifyAuthInteractor.exchangeCode - completed",
      );
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.error(
          {
            correlationId,
            error: (err as Error).message,
            stack: (err as Error).stack,
            code: "UNKNOWN",
          },
          "SpotifyAuthInteractor.exchangeCode - error occurred",
        );
        throw new ExternalServiceError("Spotify", "Invalid state parameter");
      }
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "SpotifyAuthInteractor.exchangeCode - error occurred",
      );
      throw err;
    }
  }

  async refreshToken(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const { correlationId, userId, refreshToken } = input;
    logger.info(
      { correlationId },
      "SpotifyAuthInteractor.refreshToken - started",
    );

    try {
      const tokens = await this.spotifyAuth.refreshToken(
        refreshToken,
        correlationId,
      );
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      const user = await this.userRepo.findById(userId);
      const updated = user.withSpotifyTokens(
        tokens.accessToken,
        tokens.refreshToken,
        expiresAt,
      );
      await this.userRepo.save(updated);

      logger.info(
        { correlationId },
        "SpotifyAuthInteractor.refreshToken - completed",
      );
      return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
    } catch (err) {
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "SpotifyAuthInteractor.refreshToken - error occurred",
      );
      throw err;
    }
  }
}
