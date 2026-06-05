/**
 * DynamoDB adapter integration tests.
 *
 * Requires LocalStack running:
 *   docker compose up localstack -d
 *   npm run db:create
 *
 * These tests are skipped automatically when DYNAMO_ENDPOINT is not set,
 * so they never fail in plain `npm test` without Docker.
 */

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import {
  createDynamoClient,
  loadDynamoConfig,
} from "../../src/adapters/output/dynamo/DynamoClient";
import { DynamoSessionRepository } from "../../src/adapters/output/dynamo/DynamoSessionRepository";
import { DynamoUserRepository } from "../../src/adapters/output/dynamo/DynamoUserRepository";
import { ReadingSession } from "../../src/domain/entities/ReadingSession";
import { User } from "../../src/domain/entities/User";
import { EntityNotFoundError } from "../../src/domain/errors/DomainError";
import { GeneratedPlaylist } from "../../src/domain/value-objects/GeneratedPlaylist";
import { WpmSpeed } from "../../src/domain/value-objects/WpmSpeed";

const SKIP = !process.env.DYNAMO_ENDPOINT;
const describeOrSkip = SKIP ? describe.skip : describe;

let client: DynamoDBDocumentClient;
let tableName: string;
let userRepo: DynamoUserRepository;
let sessionRepo: DynamoSessionRepository;

beforeAll(() => {
  if (SKIP) return;
  const config = loadDynamoConfig();
  tableName = config.tableName;
  client = createDynamoClient(config);
  userRepo = new DynamoUserRepository(client, tableName);
  sessionRepo = new DynamoSessionRepository(client, tableName);
});

describeOrSkip("DynamoUserRepository", () => {
  const userId = `test-user-${Date.now()}`;

  it("saves and retrieves a user by id", async () => {
    const wpm = WpmSpeed.create(280, new Date(), 2);
    const user = User.create(userId, `${userId}@test.com`, wpm);

    await userRepo.save(user);
    const retrieved = await userRepo.findById(userId);

    expect(retrieved.id).toBe(userId);
    expect(retrieved.email).toBe(`${userId}@test.com`);
    expect(retrieved.wpmSpeed.value).toBe(280);
  });

  it("updates user WPM on save", async () => {
    const wpm = WpmSpeed.create(280, new Date(), 2);
    const user = User.create(userId, `${userId}@test.com`, wpm);
    const updatedWpm = WpmSpeed.create(320, new Date(), 3);
    const updated = user.withUpdatedWpm(updatedWpm);

    await userRepo.save(updated);
    const retrieved = await userRepo.findById(userId);

    expect(retrieved.wpmSpeed.value).toBe(320);
    expect(retrieved.wpmSpeed.sampleCount).toBe(3);
  });

  it("persists and retrieves Spotify tokens", async () => {
    const wpm = WpmSpeed.create(250, new Date(), 1);
    const user = User.create(
      userId,
      `${userId}@test.com`,
      wpm,
    ).withSpotifyTokens(
      "access-tok",
      "refresh-tok",
      new Date(Date.now() + 3600 * 1000),
    );

    await userRepo.save(user);
    const retrieved = await userRepo.findById(userId);

    expect(retrieved.spotifyAccessToken).toBe("access-tok");
    expect(retrieved.hasValidSpotifyToken()).toBe(true);
  });

  it("throws EntityNotFoundError for unknown user", async () => {
    await expect(userRepo.findById("nonexistent-user-xyz")).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});

describeOrSkip("DynamoSessionRepository", () => {
  const sessionId = `test-session-${Date.now()}`;

  const stubPlaylist: GeneratedPlaylist = {
    spotifyPlaylistId: "sp-dynamo-test",
    spotifyPlaylistUrl: "https://open.spotify.com/playlist/sp-dynamo-test",
    name: "Dynamo Test Mix",
    tracks: [
      { title: "Experience", artist: "Ludovico Einaudi", spotifyTrackId: "t1" },
    ],
    durationMinutes: 25,
  };

  const session = ReadingSession.prepare(
    sessionId,
    "u-dynamo-1",
    "Deep Work",
    2,
    "Focus Chapter",
    "focus",
    20,
    stubPlaylist,
  );

  it("saves and retrieves a session by id", async () => {
    await sessionRepo.save(session);
    const retrieved = await sessionRepo.findById(sessionId);

    expect(retrieved.id).toBe(sessionId);
    expect(retrieved.bookTitle).toBe("Deep Work");
    expect(retrieved.chapterNumber).toBe(2);
    expect(retrieved.mode).toBe("focus");
    expect(retrieved.status).toBe("pending");
    expect(retrieved.playlist.name).toBe("Dynamo Test Mix");
  });

  it("updates session status on save", async () => {
    const started = session.start();
    await sessionRepo.save(started);
    const retrieved = await sessionRepo.findById(sessionId);
    expect(retrieved.status).toBe("active");
  });

  it("throws EntityNotFoundError for unknown session", async () => {
    await expect(
      sessionRepo.findById("nonexistent-session-xyz"),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
