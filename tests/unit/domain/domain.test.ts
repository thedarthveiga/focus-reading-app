import { Book } from "../../../src/domain/entities/Book";
import { ReadingSession } from "../../../src/domain/entities/ReadingSession";
import { User } from "../../../src/domain/entities/User";
import {
  DomainError,
  EntityNotFoundError,
  ExternalServiceError,
  InvalidValueError,
} from "../../../src/domain/errors/DomainError";
import {
  ReadingTimeCalculator,
  IMMERSION_BUFFER_FACTOR,
} from "../../../src/domain/services/ReadingTimeCalculator";
import { GeneratedPlaylist } from "../../../src/domain/value-objects/GeneratedPlaylist";
import { ReadingDuration } from "../../../src/domain/value-objects/ReadingDuration";
import { WpmSpeed } from "../../../src/domain/value-objects/WpmSpeed";

const defaultWpm = WpmSpeed.create(250, new Date(), 3);

const stubPlaylist: GeneratedPlaylist = {
  spotifyPlaylistId: "sp-abc",
  spotifyPlaylistUrl: "https://open.spotify.com/playlist/abc",
  name: "Focus Mix",
  tracks: [{ title: "Experience", artist: "Ludovico Einaudi" }],
  durationMinutes: 30,
};

describe("WpmSpeed", () => {
  it("creates valid WPM speed", () => {
    const wpm = WpmSpeed.create(300, new Date(), 1);
    expect(wpm.value).toBe(300);
    expect(wpm.isCalibrated()).toBe(true);
  });

  it("rejects WPM below minimum", () => {
    expect(() => WpmSpeed.create(50, new Date(), 1)).toThrow(InvalidValueError);
  });

  it("rejects WPM above maximum", () => {
    expect(() => WpmSpeed.create(1500, new Date(), 1)).toThrow(
      InvalidValueError,
    );
  });

  it("default WPM is not calibrated", () => {
    expect(WpmSpeed.default().isCalibrated()).toBe(false);
  });
});

describe("ReadingDuration", () => {
  it("computes roundedForPlaylist in 5-minute blocks", () => {
    expect(ReadingDuration.fromMinutes(13).roundedForPlaylist).toBe(15);
    expect(ReadingDuration.fromMinutes(15).roundedForPlaylist).toBe(15);
    expect(ReadingDuration.fromMinutes(16).roundedForPlaylist).toBe(20);
  });

  it("formats toString correctly", () => {
    expect(ReadingDuration.fromMinutes(75).toString()).toBe("1h 15m");
    expect(ReadingDuration.fromMinutes(30).toString()).toBe("30m");
  });

  it("rejects zero or negative duration", () => {
    expect(() => ReadingDuration.fromMinutes(0)).toThrow(InvalidValueError);
    expect(() => ReadingDuration.fromMinutes(-5)).toThrow(InvalidValueError);
  });
});

describe("User", () => {
  it("creates a valid user", () => {
    const user = User.create("u-1", "reader@example.com", defaultWpm);
    expect(user.email).toBe("reader@example.com");
    expect(user.isReadyForSession()).toBe(true);
  });

  it("normalises email to lowercase", () => {
    const user = User.create("u-1", "Reader@Example.COM", defaultWpm);
    expect(user.email).toBe("reader@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => User.create("u-1", "not-an-email", defaultWpm)).toThrow(
      InvalidValueError,
    );
  });

  it("creates updated user with new WPM immutably", () => {
    const user = User.create("u-1", "r@e.com", defaultWpm);
    const newWpm = WpmSpeed.create(400, new Date(), 4);
    const updated = user.withUpdatedWpm(newWpm);
    expect(updated.wpmSpeed.value).toBe(400);
    expect(user.wpmSpeed.value).toBe(250);
  });

  it("stores Spotify tokens via withSpotifyTokens", () => {
    const user = User.create("u-1", "r@e.com", defaultWpm);
    expect(user.hasValidSpotifyToken()).toBe(false);
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const updated = user.withSpotifyTokens("tok", "ref", expiresAt);
    expect(updated.hasValidSpotifyToken()).toBe(true);
    expect(updated.spotifyAccessToken).toBe("tok");
  });
});

describe("Book", () => {
  it("creates a valid book", () => {
    const book = Book.create("b-1", "Deep Focus", 1, "The Beginning");
    expect(book.title).toBe("Deep Focus");
    expect(book.chapterNumber).toBe(1);
    expect(book.chapterTitle).toBe("The Beginning");
  });

  it("creates a book without chapterTitle", () => {
    const book = Book.create("b-1", "Deep Focus", 3);
    expect(book.chapterTitle).toBeUndefined();
  });

  it("rejects empty title", () => {
    expect(() => Book.create("b-1", "", 1)).toThrow(InvalidValueError);
  });

  it("rejects invalid chapter number", () => {
    expect(() => Book.create("b-1", "Title", 0)).toThrow(InvalidValueError);
    expect(() => Book.create("b-1", "Title", -1)).toThrow(InvalidValueError);
  });
});

describe("ReadingTimeCalculator", () => {
  it("applies immersion buffer to raw calculation", () => {
    const wpm = WpmSpeed.create(300, new Date(), 1);
    const duration = ReadingTimeCalculator.calculate(3000, wpm);
    const expectedRaw = 3000 / 300;
    expect(duration.inMinutes).toBe(
      Math.ceil(expectedRaw * IMMERSION_BUFFER_FACTOR),
    );
  });

  it("estimates WPM from calibration data", () => {
    const wpm = ReadingTimeCalculator.estimateWpm(500, 120);
    expect(wpm).toBe(250);
  });

  it("clamps estimated WPM to valid range", () => {
    expect(ReadingTimeCalculator.estimateWpm(10, 120)).toBe(100);
    expect(ReadingTimeCalculator.estimateWpm(5000, 60)).toBe(1000);
  });
});

describe("DomainError hierarchy", () => {
  it("ExternalServiceError has correct code", () => {
    const err = new ExternalServiceError("Spotify", "timeout");
    expect(err.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(err.name).toBe("ExternalServiceError");
  });

  it("EntityNotFoundError has correct code", () => {
    const err = new EntityNotFoundError("Session", "s-99");
    expect(err.code).toBe("ENTITY_NOT_FOUND");
  });
});

describe("ReadingSession state machine", () => {
  const session = ReadingSession.prepare(
    "s-1",
    "u-1",
    "Deep Work",
    3,
    "Focus Chapter",
    "focus",
    25,
    stubPlaylist,
  );

  it("starts from pending status", () => {
    expect(session.status).toBe("pending");
  });

  it("transitions pending → active", () => {
    const active = session.start();
    expect(active.status).toBe("active");
    expect(active.startedAt).not.toBeNull();
  });

  it("transitions active → paused", () => {
    const paused = session.start().pause();
    expect(paused.status).toBe("paused");
    expect(paused.pausedAt).not.toBeNull();
  });

  it("transitions paused → active (resume)", () => {
    const resumed = session.start().pause().resume();
    expect(resumed.status).toBe("active");
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.totalPausedSeconds).toBeGreaterThanOrEqual(0);
  });

  it("transitions active → completed", () => {
    expect(session.start().complete().status).toBe("completed");
  });

  it("transitions paused → completed", () => {
    expect(session.start().pause().complete().status).toBe("completed");
  });

  it("transitions active → interrupted", () => {
    expect(session.start().interrupt().status).toBe("interrupted");
  });

  it("transitions paused → interrupted", () => {
    expect(session.start().pause().interrupt().status).toBe("interrupted");
  });

  it("cannot start an already active session", () => {
    expect(() => session.start().start()).toThrow(DomainError);
  });

  it("cannot pause a pending session", () => {
    expect(() => session.pause()).toThrow(DomainError);
  });

  it("cannot complete a pending session", () => {
    expect(() => session.complete()).toThrow(DomainError);
  });

  it("stores mode and book info", () => {
    expect(session.mode).toBe("focus");
    expect(session.bookTitle).toBe("Deep Work");
    expect(session.chapterNumber).toBe(3);
    expect(session.chapterTitle).toBe("Focus Chapter");
  });
});
