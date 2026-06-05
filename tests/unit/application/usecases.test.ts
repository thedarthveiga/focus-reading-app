import { CalibrateWpmInteractor } from "../../../src/application/use-cases/CalibrateWpmInteractor";
import { PrepareReadingSessionInteractor } from "../../../src/application/use-cases/PrepareReadingSessionInteractor";
import { User } from "../../../src/domain/entities/User";
import {
  EntityNotFoundError,
  ExternalServiceError,
} from "../../../src/domain/errors/DomainError";
import { GeneratedPlaylist } from "../../../src/domain/value-objects/GeneratedPlaylist";
import { WpmSpeed } from "../../../src/domain/value-objects/WpmSpeed";
import { AIPlaylistComposerPort } from "../../../src/ports/driven/AIPlaylistComposerPort";
import { IdGeneratorPort } from "../../../src/ports/driven/IdGeneratorPort";
import { SessionRepositoryPort } from "../../../src/ports/driven/SessionRepositoryPort";
import { SpotifyMusicPort } from "../../../src/ports/driven/SpotifyMusicPort";
import { UserRepositoryPort } from "../../../src/ports/driven/UserRepositoryPort";

const CID = "test-correlation-id";

const stubPlaylist: GeneratedPlaylist = {
  spotifyPlaylistId: "sp-123",
  spotifyPlaylistUrl: "https://open.spotify.com/playlist/sp-123",
  name: "Focus Mix",
  tracks: [{ title: "Experience", artist: "Ludovico Einaudi" }],
  durationMinutes: 20,
};

const makeUser = (wpm = 250, withToken = true) => {
  const user = User.create(
    "u-1",
    "test@example.com",
    WpmSpeed.create(wpm, new Date(), 3),
  );
  if (withToken) {
    return user.withSpotifyTokens(
      "tok",
      "ref",
      new Date(Date.now() + 3600 * 1000),
    );
  }
  return user;
};

function mockUserRepo(user: User): jest.Mocked<UserRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function mockSessionRepo(): jest.Mocked<SessionRepositoryPort> {
  return { findById: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
}

function mockAI(): jest.Mocked<AIPlaylistComposerPort> {
  return {
    estimateWordCount: jest.fn().mockResolvedValue(4500),
    composePlaylist: jest.fn().mockResolvedValue({
      playlistName: "Focus Mix",
      tracks: [{ title: "Experience", artist: "Ludovico Einaudi" }],
    }),
  };
}

function mockSpotifyMusic(): jest.Mocked<SpotifyMusicPort> {
  return {
    searchTrack: jest.fn().mockResolvedValue("track-id-1"),
    createPlaylist: jest.fn().mockResolvedValue(stubPlaylist),
    startPlayback: jest.fn().mockResolvedValue(undefined),
  };
}

function mockIdGen(id = "session-uuid-1"): jest.Mocked<IdGeneratorPort> {
  return { generate: jest.fn().mockReturnValue(id) };
}

describe("PrepareReadingSessionInteractor", () => {
  it("returns complete session output for valid input", async () => {
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser()),
      mockSessionRepo(),
      mockAI(),
      mockSpotifyMusic(),
      mockIdGen(),
    );

    const output = await interactor.execute({
      userId: "u-1",
      bookTitle: "Deep Work",
      chapterNumber: 1,
      mode: "focus",
      correlationId: CID,
    });

    expect(output.sessionId).toBe("session-uuid-1");
    expect(output.spotifyPlaylistUrl).toBe(
      "https://open.spotify.com/playlist/sp-123",
    );
    expect(output.playlistName).toBe("Focus Mix");
    expect(output.estimatedMinutes).toBeGreaterThan(0);
  });

  it("rejects when user has no valid Spotify token", async () => {
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser(250, false)),
      mockSessionRepo(),
      mockAI(),
      mockSpotifyMusic(),
      mockIdGen(),
    );

    await expect(
      interactor.execute({
        userId: "u-1",
        bookTitle: "Deep Work",
        chapterNumber: 1,
        mode: "focus",
        correlationId: CID,
      }),
    ).rejects.toThrow(ExternalServiceError);
  });

  it("saves the session after creating it", async () => {
    const sessionRepo = mockSessionRepo();
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser()),
      sessionRepo,
      mockAI(),
      mockSpotifyMusic(),
      mockIdGen(),
    );

    await interactor.execute({
      userId: "u-1",
      bookTitle: "Deep Work",
      chapterNumber: 1,
      mode: "immersion",
      correlationId: CID,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });

  it("propagates EntityNotFoundError when user does not exist", async () => {
    const userRepo: jest.Mocked<UserRepositoryPort> = {
      findById: jest
        .fn()
        .mockRejectedValue(new EntityNotFoundError("User", "u-999")),
      save: jest.fn(),
    };

    const interactor = new PrepareReadingSessionInteractor(
      userRepo,
      mockSessionRepo(),
      mockAI(),
      mockSpotifyMusic(),
      mockIdGen(),
    );

    await expect(
      interactor.execute({
        userId: "u-999",
        bookTitle: "X",
        chapterNumber: 1,
        mode: "focus",
        correlationId: CID,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it("applies 15% immersion buffer to estimated duration", async () => {
    const wpm = 300;
    const wordCount = 4500;
    const expectedRaw = wordCount / wpm;
    const expectedBuffered = Math.ceil(expectedRaw * 1.15);

    const ai = mockAI();
    ai.estimateWordCount.mockResolvedValue(wordCount);

    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser(wpm)),
      mockSessionRepo(),
      ai,
      mockSpotifyMusic(),
      mockIdGen(),
    );

    const output = await interactor.execute({
      userId: "u-1",
      bookTitle: "Deep Work",
      chapterNumber: 1,
      mode: "focus",
      correlationId: CID,
    });
    expect(output.estimatedMinutes).toBe(expectedBuffered);
  });
});

describe("CalibrateWpmInteractor", () => {
  it("updates user WPM and returns output DTO", async () => {
    const user = makeUser(200);
    const userRepo = mockUserRepo(user);
    const interactor = new CalibrateWpmInteractor(userRepo);

    const result = await interactor.execute({
      userId: "u-1",
      wordsRead: 500,
      elapsedSeconds: 120,
      correlationId: CID,
    });

    expect(result.wpm).toBe(250);
    expect(result.sampleCount).toBe(user.wpmSpeed.sampleCount + 1);
    expect(result.calibratedAt).toBeInstanceOf(Date);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });

  it("increments sample count on recalibration", async () => {
    const user = makeUser(200);
    const interactor = new CalibrateWpmInteractor(mockUserRepo(user));

    const result = await interactor.execute({
      userId: "u-1",
      wordsRead: 400,
      elapsedSeconds: 100,
      correlationId: CID,
    });

    expect(result.sampleCount).toBe(user.wpmSpeed.sampleCount + 1);
  });
});
