/**
 * Seed script — populates DynamoDB (LocalStack or real AWS) with dev/test data.
 *
 * Usage:
 *   DYNAMO_ENDPOINT=http://localhost:4566 ts-node infra/scripts/seed.ts
 */

import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const TABLE = process.env.DYNAMO_TABLE_NAME ?? 'focus-reading';
const ENDPOINT = process.env.DYNAMO_ENDPOINT;

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(ENDPOINT
      ? {
          endpoint: ENDPOINT,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
          },
        }
      : {}),
  }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const now = new Date().toISOString();

const seedItems = [
  // ── Users ──────────────────────────────────────────────────────────────────
  {
    PK: 'USER#seed-user-1',
    SK: '#METADATA',
    entityType: 'USER',
    id: 'seed-user-1',
    email: 'reader@focusreading.dev',
    wpmValue: 250,
    wpmCalibratedAt: now,
    wpmSampleCount: 3,
    createdAt: now,
  },

  // ── Book: Atomic Habits ────────────────────────────────────────────────────
  {
    PK: 'BOOK#book-atomic-habits',
    SK: '#METADATA',
    GSI1PK: 'BOOK_TITLE',
    GSI1SK: 'atomic habits',
    entityType: 'BOOK',
    id: 'book-atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    createdAt: now,
  },
  {
    PK: 'BOOK#book-atomic-habits',
    SK: 'CHAPTER#001',
    entityType: 'CHAPTER',
    bookId: 'book-atomic-habits',
    number: 1,
    title: 'The Surprising Power of Atomic Habits',
    wordCount: 4500,
    mood: 'calm',
  },
  {
    PK: 'BOOK#book-atomic-habits',
    SK: 'CHAPTER#002',
    entityType: 'CHAPTER',
    bookId: 'book-atomic-habits',
    number: 2,
    title: 'How Your Habits Shape Your Identity',
    wordCount: 5200,
    mood: 'reflective',
  },
  {
    PK: 'BOOK#book-atomic-habits',
    SK: 'CHAPTER#003',
    entityType: 'CHAPTER',
    bookId: 'book-atomic-habits',
    number: 3,
    title: 'How to Build Better Habits in 4 Simple Steps',
    wordCount: 6100,
    mood: 'action',
  },

  // ── Book: Deep Work ────────────────────────────────────────────────────────
  {
    PK: 'BOOK#book-deep-work',
    SK: '#METADATA',
    GSI1PK: 'BOOK_TITLE',
    GSI1SK: 'deep work',
    entityType: 'BOOK',
    id: 'book-deep-work',
    title: 'Deep Work',
    author: 'Cal Newport',
    createdAt: now,
  },
  {
    PK: 'BOOK#book-deep-work',
    SK: 'CHAPTER#001',
    entityType: 'CHAPTER',
    bookId: 'book-deep-work',
    number: 1,
    title: 'Deep Work Is Valuable',
    wordCount: 7200,
    mood: 'reflective',
  },
  {
    PK: 'BOOK#book-deep-work',
    SK: 'CHAPTER#002',
    entityType: 'CHAPTER',
    bookId: 'book-deep-work',
    number: 2,
    title: 'Deep Work Is Rare',
    wordCount: 5800,
    mood: 'tense',
  },
];

async function seed(): Promise<void> {
  console.log(`Seeding ${seedItems.length} items into '${TABLE}'...`);

  for (const item of seedItems) {
    await client.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log(`  ✓ ${item['PK']} / ${item['SK']}`);
  }

  console.log('\n✅ Seed complete.');
}

seed().catch(err => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
