import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { ReadingSession } from "../../../domain/entities/ReadingSession";
import { EntityNotFoundError } from "../../../domain/errors/DomainError";
import { SessionRepositoryPort } from "../../../ports/driven/SessionRepositoryPort";

import { Keys } from "./DynamoKeys";
import { SessionDynamoItem, SessionMapper } from "./mappers/SessionMapper";

export class DynamoSessionRepository implements SessionRepositoryPort {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(id: string): Promise<ReadingSession> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: Keys.session.pk(id), SK: Keys.session.sk() },
      }),
    );
    if (!result.Item) throw new EntityNotFoundError("Session", id);
    return SessionMapper.toDomain(result.Item as SessionDynamoItem);
  }

  async save(session: ReadingSession): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: SessionMapper.toItem(session),
      }),
    );
  }
}
