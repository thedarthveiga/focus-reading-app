import { User } from "../../../../domain/entities/User";
import { WpmSpeed } from "../../../../domain/value-objects/WpmSpeed";
import { Keys } from "../DynamoKeys";

export interface UserDynamoItem {
  PK: string;
  SK: string;
  entityType: "USER";
  id: string;
  email: string;
  wpmValue: number;
  wpmCalibratedAt: string;
  wpmSampleCount: number;
  createdAt: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyTokenExpiresAt?: string;
}

export const UserMapper = {
  toItem(user: User): UserDynamoItem {
    const item: UserDynamoItem = {
      PK: Keys.user.pk(user.id),
      SK: Keys.user.sk(),
      entityType: "USER",
      id: user.id,
      email: user.email,
      wpmValue: user.wpmSpeed.value,
      wpmCalibratedAt: user.wpmSpeed.calibratedAt.toISOString(),
      wpmSampleCount: user.wpmSpeed.sampleCount,
      createdAt: user.createdAt.toISOString(),
    };
    if (user.spotifyAccessToken)
      item.spotifyAccessToken = user.spotifyAccessToken;
    if (user.spotifyRefreshToken)
      item.spotifyRefreshToken = user.spotifyRefreshToken;
    if (user.spotifyTokenExpiresAt)
      item.spotifyTokenExpiresAt = user.spotifyTokenExpiresAt.toISOString();
    return item;
  },

  toDomain(item: UserDynamoItem): User {
    const wpm =
      item.wpmSampleCount > 0
        ? WpmSpeed.create(
            item.wpmValue,
            new Date(item.wpmCalibratedAt),
            item.wpmSampleCount,
          )
        : WpmSpeed.default();
    const user = User.create(item.id, item.email, wpm);
    if (
      item.spotifyAccessToken &&
      item.spotifyRefreshToken &&
      item.spotifyTokenExpiresAt
    ) {
      return user.withSpotifyTokens(
        item.spotifyAccessToken,
        item.spotifyRefreshToken,
        new Date(item.spotifyTokenExpiresAt),
      );
    }
    return user;
  },
};
