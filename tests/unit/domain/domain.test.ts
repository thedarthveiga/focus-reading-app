import { Book } from "../../../src/domain/entities/Book";
import {
  Playlist,
  MOOD_TO_FOCUS_MAP,
} from "../../../src/domain/entities/Playlist";
import { ReadingSession } from "../../../src/domain/entities/ReadingSession";
import { User } from "../../../src/domain/entities/User";
import {
  DomainError,
  InvalidValueError,
  EntityNotFoundError,
} from "../../../src/domain/errors/DomainError";
import {
  ReadingTimeCalculator,
  IMMERSION_BUFFER_FACTOR,
} from "../../../src/domain/services/ReadingTimeCalculator";
import { ReadingDuration } from "../../../src/domain/value-objects/ReadingDuration";
import { WpmSpeed } from "../../../src/domain/value-objects/WpmSpeed";

const defaultWpm = WpmSpeed.create(250, new Date(), 3);

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
    expect(user.wpmSpeed.value).toBe(250); // original unchanged
  });
});

describe("Book", () => {
  const chapters = [
    {
      number: 1,
      title: "The Beginning",
      wordCount: 3000,
      mood: "calm" as const,
    },
    { number: 2, title: "The Storm", wordCount: 5000, mood: "tense" as const },
  ];

  it("creates a valid book", () => {
    const book = Book.create("b-1", "Deep Focus", "Alice Author", chapters);
    expect(book.totalWordCount).toBe(8000);
  });

  it("retrieves a chapter by number", () => {
    const book = Book.create("b-1", "Deep Focus", "Alice Author", chapters);
    expect(book.getChapter(1).title).toBe("The Beginning");
  });

  it("throws EntityNotFoundError for missing chapter", () => {
    const book = Book.create("b-1", "Deep Focus", "Alice Author", chapters);
    expect(() => book.getChapter(99)).toThrow(EntityNotFoundError);
  });

  it("rejects book with no chapters", () => {
    expect(() => Book.create("b-1", "Empty", "Author", [])).toThrow(
      InvalidValueError,
    );
  });
});

describe("ReadingTimeCalculator", () => {
  it("applies immersion buffer to raw calculation", () => {
    const wpm = WpmSpeed.create(300, new Date(), 1);
    const duration = ReadingTimeCalculator.calculate(3000, wpm);
    const expectedRaw = 3000 / 300; // 10 minutes
    expect(duration.inMinutes).toBe(
      Math.ceil(expectedRaw * IMMERSION_BUFFER_FACTOR),
    );
  });

  it("estimates WPM from calibration data", () => {
    const wpm = ReadingTimeCalculator.estimateWpm(500, 120); // 500 words in 2 min = 250 wpm
    expect(wpm).toBe(250);
  });

  it("clamps estimated WPM to valid range", () => {
    expect(ReadingTimeCalculator.estimateWpm(10, 120)).toBe(100); // very slow → clamped to min
    expect(ReadingTimeCalculator.estimateWpm(5000, 60)).toBe(1000); // very fast → clamped to max
  });
});

describe("ReadingSession state machine", () => {
  const playlist = Playlist.create(
    "p-1",
    "spotify-abc",
    "alpha-waves",
    30,
    "Focus Mix",
  );
  const session = ReadingSession.prepare("s-1", "u-1", "b-1", 1, 25, playlist);

  it("starts from pending status", () => {
    expect(session.status).toBe("pending");
  });

  it("transitions pending → active", () => {
    const active = session.start();
    expect(active.status).toBe("active");
    expect(active.startedAt).not.toBeNull();
  });

  it("transitions active → completed", () => {
    const completed = session.start().complete();
    expect(completed.status).toBe("completed");
  });

  it("transitions active → interrupted", () => {
    const interrupted = session.start().interrupt();
    expect(interrupted.status).toBe("interrupted");
  });

  it("cannot start an already active session", () => {
    expect(() => session.start().start()).toThrow(DomainError);
  });

  it("cannot complete a pending session", () => {
    expect(() => session.complete()).toThrow(DomainError);
  });
});

describe("MOOD_TO_FOCUS_MAP", () => {
  it("maps reflective and calm moods to alpha-waves", () => {
    expect(MOOD_TO_FOCUS_MAP.reflective).toBe("alpha-waves");
    expect(MOOD_TO_FOCUS_MAP.calm).toBe("alpha-waves");
  });

  it("maps tense to binaural-beats", () => {
    expect(MOOD_TO_FOCUS_MAP.tense).toBe("binaural-beats");
  });
});
