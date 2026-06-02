/**
 * DynamoDB adapter integration tests.
 *
 * Requires LocalStack running:
 *   docker compose up localstack -d
 *   npm run db:create
 *
 * Or in CI: the 'integration-dynamo' job spins up LocalStack as a service.
 *
 * These tests are skipped automatically when DYNAMO_ENDPOINT is not set,
 * so they never fail in plain `npm test` without Docker.
 */

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { DynamoBookRepository } from '../../src/adapters/output/dynamo/DynamoBookRepository';
import { createDynamoClient, loadDynamoConfig } from '../../src/adapters/output/dynamo/DynamoClient';
import { DynamoUserRepository } from '../../src/adapters/output/dynamo/DynamoUserRepository';
import { Book } from '../../src/domain/entities/Book';
import { User } from '../../src/domain/entities/User';
import { EntityNotFoundError } from '../../src/domain/errors/DomainError';
import { WpmSpeed } from '../../src/domain/value-objects/WpmSpeed';

const SKIP = !process.env.DYNAMO_ENDPOINT;
const describeOrSkip = SKIP ? describe.skip : describe;

let client: DynamoDBDocumentClient;
let tableName: string;
let userRepo: DynamoUserRepository;
let bookRepo: DynamoBookRepository;

beforeAll(() => {
  if (SKIP) return;
  const config = loadDynamoConfig();
  tableName = config.tableName;
  client = createDynamoClient(config);
  userRepo = new DynamoUserRepository(client, tableName);
  bookRepo = new DynamoBookRepository(client, tableName);
});

describeOrSkip('DynamoUserRepository', () => {
  const userId = `test-user-${Date.now()}`;

  it('saves and retrieves a user by id', async () => {
    const wpm = WpmSpeed.create(280, new Date(), 2);
    const user = User.create(userId, `${userId}@test.com`, wpm);

    await userRepo.save(user);
    const retrieved = await userRepo.findById(userId);

    expect(retrieved.id).toBe(userId);
    expect(retrieved.email).toBe(`${userId}@test.com`);
    expect(retrieved.wpmSpeed.value).toBe(280);
  });

  it('updates user WPM on save', async () => {
    const wpm = WpmSpeed.create(280, new Date(), 2);
    const user = User.create(userId, `${userId}@test.com`, wpm);
    const updatedWpm = WpmSpeed.create(320, new Date(), 3);
    const updated = user.withUpdatedWpm(updatedWpm);

    await userRepo.save(updated);
    const retrieved = await userRepo.findById(userId);

    expect(retrieved.wpmSpeed.value).toBe(320);
    expect(retrieved.wpmSpeed.sampleCount).toBe(3);
  });

  it('throws EntityNotFoundError for unknown user', async () => {
    await expect(userRepo.findById('nonexistent-user-xyz')).rejects.toThrow(EntityNotFoundError);
  });
});

describeOrSkip('DynamoBookRepository', () => {
  const bookId = `test-book-${Date.now()}`;

  const book = Book.create(bookId, 'Test Book on Focus', 'Test Author', [
    { number: 1, title: 'Introduction', wordCount: 3000, mood: 'calm' },
    { number: 2, title: 'The Method',   wordCount: 5500, mood: 'reflective' },
    { number: 3, title: 'The Challenge', wordCount: 4200, mood: 'tense' },
  ]);

  it('saves and retrieves a book with all chapters', async () => {
    await bookRepo.save(book);
    const retrieved = await bookRepo.findById(bookId);

    expect(retrieved.id).toBe(bookId);
    expect(retrieved.title).toBe('Test Book on Focus');
    expect(retrieved.chaptersMetadata).toHaveLength(3);
    expect(retrieved.totalWordCount).toBe(12700);
  });

  it('retrieves a specific chapter correctly', async () => {
    const retrieved = await bookRepo.findById(bookId);
    const ch2 = retrieved.getChapter(2);

    expect(ch2.title).toBe('The Method');
    expect(ch2.wordCount).toBe(5500);
    expect(ch2.mood).toBe('reflective');
  });

  it('finds books by title prefix via GSI1', async () => {
    const results = await bookRepo.findByTitle('Test Book');
    const found = results.find(b => b.id === bookId);
    expect(found).toBeDefined();
  });

  it('throws EntityNotFoundError for unknown book', async () => {
    await expect(bookRepo.findById('nonexistent-book-xyz')).rejects.toThrow(EntityNotFoundError);
  });
});
