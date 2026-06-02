import { DomainError } from '../errors/DomainError';
import { SessionStatus } from '../value-objects/SessionStatus';

import { Playlist } from './Playlist';

export class ReadingSession {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly bookId: string,
    readonly chapterNumber: number,
    readonly estimatedDurationMinutes: number,
    readonly playlist: Playlist,
    readonly status: SessionStatus,
    readonly createdAt: Date,
    readonly startedAt: Date | null,
    readonly completedAt: Date | null,
  ) {}

  static prepare(
    id: string,
    userId: string,
    bookId: string,
    chapterNumber: number,
    estimatedDurationMinutes: number,
    playlist: Playlist,
  ): ReadingSession {
    return new ReadingSession(
      id, userId, bookId, chapterNumber,
      estimatedDurationMinutes, playlist,
      'pending', new Date(), null, null,
    );
  }

  start(): ReadingSession {
    if (this.status !== 'pending') {
      throw new DomainError(`Cannot start a session in status '${this.status}'`, 'INVALID_SESSION_TRANSITION');
    }
    return new ReadingSession(
      this.id, this.userId, this.bookId, this.chapterNumber,
      this.estimatedDurationMinutes, this.playlist,
      'active', this.createdAt, new Date(), null,
    );
  }

  complete(): ReadingSession {
    if (this.status !== 'active') {
      throw new DomainError(`Cannot complete a session in status '${this.status}'`, 'INVALID_SESSION_TRANSITION');
    }
    return new ReadingSession(
      this.id, this.userId, this.bookId, this.chapterNumber,
      this.estimatedDurationMinutes, this.playlist,
      'completed', this.createdAt, this.startedAt, new Date(),
    );
  }

  interrupt(): ReadingSession {
    if (this.status !== 'active') {
      throw new DomainError(`Cannot interrupt a session in status '${this.status}'`, 'INVALID_SESSION_TRANSITION');
    }
    return new ReadingSession(
      this.id, this.userId, this.bookId, this.chapterNumber,
      this.estimatedDurationMinutes, this.playlist,
      'interrupted', this.createdAt, this.startedAt, new Date(),
    );
  }
}
