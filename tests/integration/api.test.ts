import Fastify, { FastifyInstance } from 'fastify';
import { registerReadingSessionRoutes } from '../../../src/adapters/input/rest/ReadingSessionController';
import { PrepareReadingSessionInteractor } from '../../../src/application/use-cases/PrepareReadingSessionInteractor';
import { CalibrateWpmInteractor } from '../../../src/application/use-cases/CalibrateWpmInteractor';
import { InMemoryUserRepository } from '../../../src/adapters/output/repositories/InMemoryUserRepository';
import { InMemoryBookRepository } from '../../../src/adapters/output/repositories/InMemoryBookRepository';
import { UuidGenerator } from '../../../src/adapters/output/repositories/UuidGenerator';
import { User } from '../../../src/domain/entities/User';
import { Book } from '../../../src/domain/entities/Book';
import { Playlist } from '../../../src/domain/entities/Playlist';
import { WpmSpeed } from '../../../src/domain/value-objects/WpmSpeed';
import { SpotifyServicePort } from '../../../src/ports/driven/SpotifyServicePort';

// Stub Spotify — no real API calls in integration tests
class StubSpotifyService implements SpotifyServicePort {
  async findPlaylistFor(): Promise<Playlist> {
    return Playlist.create('p-stub', 'spotify-stub-001', 'alpha-waves', 60, 'Stub Focus Mix');
  }
}

function buildTestApp(): FastifyInstance {
  const userRepo = new InMemoryUserRepository([
    User.create('u-test-1', 'reader@test.com', WpmSpeed.create(250, new Date(), 2)),
  ]);

  const bookRepo = new InMemoryBookRepository([
    Book.create('b-test-1', 'Atomic Habits', 'James Clear', [
      { number: 1, title: 'The Surprising Power', wordCount: 4500, mood: 'calm' },
      { number: 2, title: 'Identity-Based Habits', wordCount: 3800, mood: 'reflective' },
    ]),
  ]);

  const spotify = new StubSpotifyService();
  const idGen = new UuidGenerator();

  const prepareUseCase = new PrepareReadingSessionInteractor(userRepo, bookRepo, spotify, idGen);
  const calibrateUseCase = new CalibrateWpmInteractor(userRepo);

  const app = Fastify({ logger: false });
  registerReadingSessionRoutes(app, prepareUseCase, calibrateUseCase);
  return app;
}

describe('POST /sessions/prepare', () => {
  let app: FastifyInstance;

  beforeEach(() => { app = buildTestApp(); });
  afterEach(async () => { await app.close(); });

  it('returns 201 with session output for valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/prepare',
      payload: { userId: 'u-test-1', bookId: 'b-test-1', chapterNumber: 1 },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      sessionId: expect.any(String),
      estimatedMinutes: expect.any(Number),
      spotifyPlaylistId: 'spotify-stub-001',
      focusType: 'alpha-waves',
      chapterTitle: 'The Surprising Power',
    });
  });

  it('returns 404 for unknown user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/prepare',
      payload: { userId: 'u-unknown', bookId: 'b-test-1', chapterNumber: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for unknown chapter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/prepare',
      payload: { userId: 'u-test-1', bookId: 'b-test-1', chapterNumber: 99 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/prepare',
      payload: { userId: 'u-test-1' }, // missing bookId and chapterNumber
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /sessions/calibrate', () => {
  let app: FastifyInstance;

  beforeEach(() => { app = buildTestApp(); });
  afterEach(async () => { await app.close(); });

  it('returns 200 with updated WPM', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/calibrate',
      payload: { userId: 'u-test-1', wordsRead: 500, elapsedSeconds: 120 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { wpm: number };
    expect(body.wpm).toBe(250);
  });

  it('returns 400 for invalid calibration data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/calibrate',
      payload: { userId: 'u-test-1', wordsRead: -10, elapsedSeconds: 60 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(() => { app = buildTestApp(); });
  afterEach(async () => { await app.close(); });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('ok');
  });
});
