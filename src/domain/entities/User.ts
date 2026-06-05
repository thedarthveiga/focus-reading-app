import { InvalidValueError } from "../errors/DomainError";
import { WpmSpeed } from "../value-objects/WpmSpeed";

export type UserId = string & { readonly _brand: "UserId" };

export function toUserId(id: string): UserId {
  if (!id || id.trim().length === 0) {
    throw new InvalidValueError("userId", "must not be empty");
  }
  return id as UserId;
}

export class User {
  private constructor(
    readonly id: UserId,
    readonly email: string,
    readonly wpmSpeed: WpmSpeed,
    readonly createdAt: Date,
    readonly spotifyAccessToken: string | null,
    readonly spotifyRefreshToken: string | null,
    readonly spotifyTokenExpiresAt: Date | null,
  ) {}

  static create(id: string, email: string, wpmSpeed: WpmSpeed): User {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidValueError("email", "must be a valid email address");
    }
    return new User(
      toUserId(id),
      email.toLowerCase().trim(),
      wpmSpeed,
      new Date(),
      null,
      null,
      null,
    );
  }

  withUpdatedWpm(wpmSpeed: WpmSpeed): User {
    return new User(
      this.id,
      this.email,
      wpmSpeed,
      this.createdAt,
      this.spotifyAccessToken,
      this.spotifyRefreshToken,
      this.spotifyTokenExpiresAt,
    );
  }

  withSpotifyTokens(
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ): User {
    return new User(
      this.id,
      this.email,
      this.wpmSpeed,
      this.createdAt,
      accessToken,
      refreshToken,
      expiresAt,
    );
  }

  isReadyForSession(): boolean {
    return this.wpmSpeed.isCalibrated();
  }

  hasValidSpotifyToken(): boolean {
    return (
      this.spotifyAccessToken !== null &&
      this.spotifyTokenExpiresAt !== null &&
      this.spotifyTokenExpiresAt > new Date()
    );
  }
}
