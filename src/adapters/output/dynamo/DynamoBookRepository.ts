import {
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { Book } from '../../../domain/entities/Book';
import { EntityNotFoundError } from '../../../domain/errors/DomainError';
import { BookRepositoryPort } from '../../../ports/driven/BookRepositoryPort';

import { GSI1_INDEX, Keys } from './DynamoKeys';
import { BookDynamoItem, BookMapper, ChapterDynamoItem } from './mappers/BookMapper';

export class DynamoBookRepository implements BookRepositoryPort {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Fetches book metadata + all chapters in a single Query.
   * Access pattern #4: PK = BOOK#<id>, no SK filter → returns book + all CHAPTER# items.
   */
  async findById(id: string): Promise<Book> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': Keys.book.pk(id),
        },
      }),
    );

    const items = result.Items ?? [];
    const bookItem = items.find(i => i['SK'] === Keys.book.sk()) as BookDynamoItem | undefined;
    const chapterItems = items.filter(i =>
      (i['SK'] as string).startsWith(Keys.book.chapterPrefix()),
    ) as ChapterDynamoItem[];

    if (!bookItem) {
      throw new EntityNotFoundError('Book', id);
    }

    if (chapterItems.length === 0) {
      throw new EntityNotFoundError('Book chapters', id);
    }

    return BookMapper.toDomain(bookItem, chapterItems);
  }

  /**
   * Search by title using GSI1.
   * Access pattern #7: GSI1PK = BOOK_TITLE, GSI1SK begins_with <title>.
   */
  async findByTitle(title: string): Promise<Book[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :titlePrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': Keys.gsi1.bookTitlePk(),
          ':titlePrefix': title.toLowerCase().trim(),
        },
      }),
    );

    const bookItems = (result.Items ?? []) as BookDynamoItem[];

    // Fetch full book (with chapters) for each result
    const books = await Promise.all(bookItems.map(item => this.findById(item.id)));
    return books;
  }

  /**
   * Saves book metadata + all chapter items as a DynamoDB transaction.
   * Atomic: either all items are written or none.
   */
  async save(book: Book): Promise<void> {
    const bookItem = BookMapper.toBookItem(book);
    const chapterItems = BookMapper.toChapterItems(book);

    const allItems = [bookItem, ...chapterItems];

    // DynamoDB TransactWrite supports up to 100 items
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: allItems.map(item => ({
          Put: {
            TableName: this.tableName,
            Item: item,
          },
        })),
      }),
    );
  }
}
