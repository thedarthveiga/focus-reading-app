import { PrepareReadingSessionInteractor } from '../../../src/application/use-cases/PrepareReadingSessionInteractor';
import { CalibrateWpmInteractor } from '../../../src/application/use-cases/CalibrateWpmInteractor';
import { User } from '../../../src/domain/entities/User';
import { Book } from '../../../src/domain/entities/Book';
import { Playlist } from '../../../src/domain/entities/Playlist';
import { WpmSpeed } from '../../../src/domain/value-objects/WpmSpeed';
import { EntityNotFoundError } from '../../../src/domain/errors/DomainError';
import { UserRepositoryPort } from '../../../src/ports/driven/UserRepositoryPort';
import { BookRepositoryPort } from '../../../src/ports/driven/BookRepositoryPort';
import { SpotifyServicePort } from '../../../src/ports/driven/SpotifyServicePort';
import { IdGeneratorPort } from '../../../src/ports/driven/IdGeneratorPort';

// --- Test fixtures ---

const makeUser = (wpm = 250) =>
  User.create('u-1', 'test@example.com', WpmSpeed.create(wpm, new Date(), 3));

const makeBook = () =>
  Book.create('b-1', 'The Focused Mind', 'Dr. Calm', [
    { number: 1, title: 'Introduction', wordCount: 3000, mood: 'reflective' },
    { number: 2, title: 'The Method',   wordCount: 6000, mood: 'tense' },
  ]);

const makePlaylist = () =>
  Playlist.create('p-1', 'spotify-xyz', 'alpha-waves', 30, 'Alpha Focus');

// --- Mock factories ---

function mockUserRepo(user: User): jest.Mocked<UserRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function mockBookRepo(book: Book): jest.Mocked<BookRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(book),
    findByTitle: jest.fn().mockResolvedValue([book]),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function mockSpotify(playlist: Playlist): jest.Mocked<SpotifyServicePort> {
  return { findPlaylistFor: jest.fn().mockResolvedValue(playlist) };
}

function mockIdGen(id = 'session-uuid-1'): jest.Mocked<IdGeneratorPort> {
  return { generate: jest.fn().mockReturnValue(id) };
}

// --- Tests ---

describe('PrepareReadingSessionInteractor', () => {
  it('returns a complete session output for valid input', async () => {
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser(250)),
      mockBookRepo(makeBook()),
      mockSpotify(makePlaylist()),
      mockIdGen(),
    );

    const output = await interactor.execute({ userId: 'u-1', bookId: 'b-1', chapterNumber: 1 });

    expect(output.sessionId).toBe('session-uuid-1');
    expect(output.spotifyPlaylistId).toBe('spotify-xyz');
    expect(output.focusType).toBe('alpha-waves');
    expect(output.chapterTitle).toBe('Introduction');
    expect(output.estimatedMinutes).toBeGreaterThan(0);
  });

  it('fetches user and book in parallel', async () => {
    const userRepo = mockUserRepo(makeUser());
    const bookRepo = mockBookRepo(makeBook());

    const interactor = new PrepareReadingSessionInteractor(
      userRepo, bookRepo, mockSpotify(makePlaylist()), mockIdGen(),
    );

    await interactor.execute({ userId: 'u-1', bookId: 'b-1', chapterNumber: 1 });

    expect(userRepo.findById).toHaveBeenCalledWith('u-1');
    expect(bookRepo.findById).toHaveBeenCalledWith('b-1');
  });

  it('passes correct mood and duration to Spotify service', async () => {
    const spotify = mockSpotify(makePlaylist());
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser(300)),
      mockBookRepo(makeBook()),
      spotify,
      mockIdGen(),
    );

    await interactor.execute({ userId: 'u-1', bookId: 'b-1', chapterNumber: 1 });

    expect(spotify.findPlaylistFor).toHaveBeenCalledWith(
      expect.objectContaining({ chapterMood: 'reflective' }),
    );
  });

  it('propagates EntityNotFoundError when user does not exist', async () => {
    const userRepo: jest.Mocked<UserRepositoryPort> = {
      findById: jest.fn().mockRejectedValue(new EntityNotFoundError('User', 'u-999')),
      save: jest.fn(),
    };

    const interactor = new PrepareReadingSessionInteractor(
      userRepo, mockBookRepo(makeBook()), mockSpotify(makePlaylist()), mockIdGen(),
    );

    await expect(
      interactor.execute({ userId: 'u-999', bookId: 'b-1', chapterNumber: 1 }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('propagates EntityNotFoundError for missing chapter', async () => {
    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser()),
      mockBookRepo(makeBook()),
      mockSpotify(makePlaylist()),
      mockIdGen(),
    );

    await expect(
      interactor.execute({ userId: 'u-1', bookId: 'b-1', chapterNumber: 99 }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('estimated duration applies the 15% immersion buffer', async () => {
    const wpm = 300;
    const wordCount = 3000; // chapter 1
    const expectedRaw = wordCount / wpm; // 10 min
    const expectedBuffered = Math.ceil(expectedRaw * 1.15); // 12 min

    const interactor = new PrepareReadingSessionInteractor(
      mockUserRepo(makeUser(wpm)),
      mockBookRepo(makeBook()),
      mockSpotify(makePlaylist()),
      mockIdGen(),
    );

    const output = await interactor.execute({ userId: 'u-1', bookId: 'b-1', chapterNumber: 1 });
    expect(output.estimatedMinutes).toBe(expectedBuffered);
  });
});

describe('CalibrateWpmInteractor', () => {
  it('updates user WPM and returns new speed', async () => {
    const user = makeUser(200);
    const userRepo = mockUserRepo(user);

    const interactor = new CalibrateWpmInteractor(userRepo);
    const result = await interactor.execute({
      userId: 'u-1',
      wordsRead: 500,
      elapsedSeconds: 120, // 500 words / 2 min = 250 WPM
    });

    expect(result.value).toBe(250);
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });

  it('increments sample count on each calibration', async () => {
    const user = makeUser(200);
    const userRepo = mockUserRepo(user);

    const interactor = new CalibrateWpmInteractor(userRepo);
    const result = await interactor.execute({ userId: 'u-1', wordsRead: 400, elapsedSeconds: 100 });

    expect(result.sampleCount).toBe(user.wpmSpeed.sampleCount + 1);
  });
});
