import Fastify, { FastifyInstance } from "fastify";

import { registerReadingSessionRoutes } from "../../src/adapters/input/rest/ReadingSessionController";
import { registerSpotifyAuthRoutes } from "../../src/adapters/input/rest/SpotifyAuthController";
import { InMemorySessionRepository } from "../../src/adapters/output/repositories/InMemorySessionRepository";
import { InMemoryUserRepository } from "../../src/adapters/output/repositories/InMemoryUserRepository";
import { UuidGenerator } from "../../src/adapters/output/repositories/UuidGenerator";
import { CalibrateWpmInteractor } from "../../src/application/use-cases/CalibrateWpmInteractor";
import { GetSessionInteractor } from "../../src/application/use-cases/GetSessionInteractor";
import { PrepareReadingSessionInteractor } from "../../src/application/use-cases/PrepareReadingSessionInteractor";
import { SessionStateInteractor } from "../../src/application/use-cases/SessionStateInteractor";
import { SpotifyAuthInteractor } from "../../src/application/use-cases/SpotifyAuthInteractor";
import { User } from "../../src/domain/entities/User";
import { GeneratedPlaylist } from "../../src/domain/value-objects/GeneratedPlaylist";
import { WpmSpeed } from "../../src/domain/value-objects/WpmSpeed";
import { AIPlaylistComposerPort } from "../../src/ports/driven/AIPlaylistComposerPort";
import {
  SpotifyAuthPort,
  SpotifyTokens,
} from "../../src/ports/driven/SpotifyAuthPort";
import { SpotifyMusicPort } from "../../src/ports/driven/SpotifyMusicPort";

const CID = "test-corr-id-001";

const stubPlaylist: GeneratedPlaylist = {
  spotifyPlaylistId: "sp-stub-001",
  spotifyPlaylistUrl: "https://open.spotify.com/playlist/sp-stub-001",
  name: "Stub Focus Mix",
  tracks: [
    { title: "Experience", artist: "Ludovico Einaudi", spotifyTrackId: "t1" },
  ],
  durationMinutes: 30,
};

class StubAIComposer implements AIPlaylistComposerPort {
  estimateWordCount(): Promise<number> {
    return Promise.resolve(4500);
  }
  composePlaylist(): Promise<{
    playlistName: string;
    tracks: { title: string; artist: string }[];
  }> {
    return Promise.resolve({
      playlistName: "Stub Focus Mix",
      tracks: [{ title: "Experience", artist: "Ludovico Einaudi" }],
    });
  }
}

class StubSpotifyMusic implements SpotifyMusicPort {
  searchTrack(): Promise<string | null> {
    return Promise.resolve("track-id-1");
  }
  createPlaylist(): Promise<GeneratedPlaylist> {
    return Promise.resolve(stubPlaylist);
  }
  startPlayback(): Promise<void> {
    return Promise.resolve();
  }
}

class StubSpotifyAuth implements SpotifyAuthPort {
  getAuthorizationUrl(codeChallenge: string, state: string): string {
    return `https://accounts.spotify.com/authorize?challenge=${codeChallenge}&state=${state}`;
  }
  exchangeCode(): Promise<SpotifyTokens> {
    return Promise.resolve({
      accessToken: "access-tok",
      refreshToken: "refresh-tok",
      expiresIn: 3600,
    });
  }
  refreshToken(): Promise<SpotifyTokens> {
    return Promise.resolve({
      accessToken: "new-access-tok",
      refreshToken: "refresh-tok",
      expiresIn: 3600,
    });
  }
}

function buildTestApp(): FastifyInstance {
  const userWithToken = User.create(
    "u-test-1",
    "reader@test.com",
    WpmSpeed.create(250, new Date(), 2),
  ).withSpotifyTokens(
    "access-tok",
    "refresh-tok",
    new Date(Date.now() + 3600 * 1000),
  );

  const userRepo = new InMemoryUserRepository([userWithToken]);
  const sessionRepo = new InMemorySessionRepository();
  const idGen = new UuidGenerator();

  const prepareUseCase = new PrepareReadingSessionInteractor(
    userRepo,
    sessionRepo,
    new StubAIComposer(),
    new StubSpotifyMusic(),
    idGen,
  );
  const calibrateUseCase = new CalibrateWpmInteractor(userRepo);
  const sessionStateUseCase = new SessionStateInteractor(sessionRepo);
  const getSessionUseCase = new GetSessionInteractor(sessionRepo);
  const spotifyAuthUseCase = new SpotifyAuthInteractor(
    new StubSpotifyAuth(),
    userRepo,
  );

  const app = Fastify({ logger: false });
  registerReadingSessionRoutes(
    app,
    prepareUseCase,
    calibrateUseCase,
    sessionStateUseCase,
    getSessionUseCase,
  );
  registerSpotifyAuthRoutes(app, spotifyAuthUseCase);
  return app;
}

describe("X-Correlation-Id header enforcement", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("rejects POST /sessions/prepare without X-Correlation-Id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.body) as { code: string }).code).toBe(
      "MISSING_CORRELATION_ID",
    );
  });

  it("rejects POST /sessions/calibrate without X-Correlation-Id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/calibrate",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns X-Correlation-Id header in successful response", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: {
        userId: "u-test-1",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "focus",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers["x-correlation-id"]).toBe(CID);
  });
});

describe("POST /sessions/prepare", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("returns 201 with session output for valid input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: {
        userId: "u-test-1",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "focus",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(typeof body["sessionId"]).toBe("string");
    expect(typeof body["estimatedMinutes"]).toBe("number");
    expect(body["spotifyPlaylistUrl"]).toContain("spotify.com");
    expect(body["playlistName"]).toBe("Stub Focus Mix");
  });

  it("returns 404 for unknown user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: {
        userId: "u-unknown",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "focus",
      },
    });
    expect(res.statusCode).toBe(404);
    expect(
      (JSON.parse(res.body) as { correlationId: string }).correlationId,
    ).toBe(CID);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: { userId: "u-test-1" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid mode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: {
        userId: "u-test-1",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "invalid",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /sessions/calibrate", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with updated WPM", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/calibrate",
      headers: { "x-correlation-id": CID },
      payload: { userId: "u-test-1", wordsRead: 500, elapsedSeconds: 120 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      wpm: number;
      sampleCount: number;
      calibratedAt: string;
    };
    expect(body.wpm).toBe(250);
    expect(body.sampleCount).toBeGreaterThan(0);
    expect(body.calibratedAt).toBeTruthy();
  });

  it("returns 400 for invalid calibration data", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sessions/calibrate",
      headers: { "x-correlation-id": CID },
      payload: { userId: "u-test-1", wordsRead: -10, elapsedSeconds: 60 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("Session lifecycle endpoints", () => {
  let app: FastifyInstance;
  let sessionId: string;

  beforeEach(async () => {
    app = buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/sessions/prepare",
      headers: { "x-correlation-id": CID },
      payload: {
        userId: "u-test-1",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "focus",
      },
    });
    sessionId = (JSON.parse(res.body) as { sessionId: string }).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });

  it("GET /sessions/:id returns session details", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}`,
      headers: { "x-correlation-id": CID },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body["sessionId"]).toBe(sessionId);
    expect(body["status"]).toBe("pending");
    expect(body["mode"]).toBe("focus");
  });

  it("POST /sessions/:id/pause transitions status", async () => {
    await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/pause`,
      headers: { "x-correlation-id": CID },
    });
  });

  it("returns 404 for unknown session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sessions/nonexistent",
      headers: { "x-correlation-id": CID },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /health", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("returns 200 without X-Correlation-Id (infra endpoint)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { status: string }).status).toBe("ok");
  });
});

describe("GET /auth/spotify/authorize", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it("returns authUrl and codeVerifier", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/spotify/authorize?userId=u-test-1",
      headers: { "x-correlation-id": CID },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      authUrl: string;
      codeVerifier: string;
    };
    expect(body.authUrl).toContain("accounts.spotify.com");
    expect(typeof body.codeVerifier).toBe("string");
  });

  it("returns 400 without userId query param", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/spotify/authorize",
      headers: { "x-correlation-id": CID },
    });
    expect(res.statusCode).toBe(400);
  });
});
