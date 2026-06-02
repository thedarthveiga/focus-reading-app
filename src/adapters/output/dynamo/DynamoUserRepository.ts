import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { User } from "../../../domain/entities/User";
import { EntityNotFoundError } from "../../../domain/errors/DomainError";
import { UserRepositoryPort } from "../../../ports/driven/UserRepositoryPort";

import { Keys } from "./DynamoKeys";
import { UserDynamoItem, UserMapper } from "./mappers/UserMapper";

export class DynamoUserRepository implements UserRepositoryPort {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(id: string): Promise<User> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: Keys.user.pk(id),
          SK: Keys.user.sk(),
        },
      }),
    );

    if (!result.Item) {
      throw new EntityNotFoundError("User", id);
    }

    return UserMapper.toDomain(result.Item as UserDynamoItem);
  }

  async save(user: User): Promise<void> {
    const item = UserMapper.toItem(user);

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  /**
   * Creates a user only if it doesn't already exist.
   * Uses a conditional write to prevent overwrites.
   */
  async createIfNotExists(user: User): Promise<void> {
    const item = UserMapper.toItem(user);

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    } catch (err: unknown) {
      const isConditionalCheckFailed =
        err instanceof Error && err.name === "ConditionalCheckFailedException";
      if (!isConditionalCheckFailed) throw err;
      // User already exists — silently ignore
    }
  }
}
