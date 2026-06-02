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
}

export const UserMapper = {
  toItem(user: User): UserDynamoItem {
    return {
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
  },

  toDomain(item: UserDynamoItem): User {
    const wpm = WpmSpeed.create(
      item.wpmValue,
      new Date(item.wpmCalibratedAt),
      item.wpmSampleCount,
    );
    return User.create(item.id, item.email, wpm);
  },
};
