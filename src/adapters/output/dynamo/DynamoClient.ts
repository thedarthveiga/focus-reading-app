import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoConfig {
  tableName: string;
  region: string;
  endpoint?: string; // set for LocalStack
}

export function loadDynamoConfig(): DynamoConfig {
  const tableName = process.env.DYNAMO_TABLE_NAME ?? "focus-reading";
  const region = process.env.AWS_REGION ?? "us-east-1";
  // DYNAMO_ENDPOINT is set in docker-compose for LocalStack; absent in production
  const endpoint = process.env.DYNAMO_ENDPOINT;

  return { tableName, region, endpoint };
}

export function createDynamoClient(
  config: DynamoConfig,
): DynamoDBDocumentClient {
  const baseClient = new DynamoDBClient({
    region: config.region,
    ...(config.endpoint
      ? {
          endpoint: config.endpoint,
          credentials: {
            // LocalStack accepts any dummy credentials
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
          },
        }
      : {}),
  });

  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
  });
}
