import { CreateTableCommand, DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

/**
 * Idempotent table creation script.
 * Run at startup (dev) or as a one-time migration (production).
 *
 * Usage:
 *   DYNAMO_ENDPOINT=http://localhost:4566 ts-node infra/scripts/createTable.ts
 */

const TABLE_NAME = process.env.DYNAMO_TABLE_NAME ?? 'focus-reading';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const ENDPOINT = process.env.DYNAMO_ENDPOINT;

const client = new DynamoDBClient({
  region: REGION,
  ...(ENDPOINT
    ? {
        endpoint: ENDPOINT,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
        },
      }
    : {}),
});

async function tableExists(): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function createTable(): Promise<void> {
  if (await tableExists()) {
    console.log(`✓ Table '${TABLE_NAME}' already exists — skipping creation.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST', // on-demand — no capacity planning needed for MVP

      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
      ],

      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],

      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );

  console.log(`✓ Table '${TABLE_NAME}' created successfully.`);
}

createTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('✗ Failed to create table:', err);
    process.exit(1);
  });
