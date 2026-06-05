import { DomainError } from "../errors/DomainError";
import { GeneratedPlaylist } from "../value-objects/GeneratedPlaylist";
import { ReadingMode } from "../value-objects/ReadingMode";
import { SessionStatus } from "../value-objects/SessionStatus";

export class ReadingSession {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly bookTitle: string,
    readonly chapterNumber: number,
    readonly chapterTitle: string | undefined,
    readonly mode: ReadingMode,
    readonly estimatedDurationMinutes: number,
    readonly playlist: GeneratedPlaylist,
    readonly status: SessionStatus,
    readonly createdAt: Date,
    readonly startedAt: Date | null,
    readonly completedAt: Date | null,
    readonly pausedAt: Date | null,
    readonly totalPausedSeconds: number,
  ) {}

  static prepare(
    id: string,
    userId: string,
    bookTitle: string,
    chapterNumber: number,
    chapterTitle: string | undefined,
    mode: ReadingMode,
    estimatedDurationMinutes: number,
    playlist: GeneratedPlaylist,
  ): ReadingSession {
    return new ReadingSession(
      id,
      userId,
      bookTitle,
      chapterNumber,
      chapterTitle,
      mode,
      estimatedDurationMinutes,
      playlist,
      "pending",
      new Date(),
      null,
      null,
      null,
      0,
    );
  }

  start(): ReadingSession {
    if (this.status !== "pending") {
      throw new DomainError(
        `Cannot start a session in status '${this.status}'`,
        "INVALID_SESSION_TRANSITION",
      );
    }
    return new ReadingSession(
      this.id,
      this.userId,
      this.bookTitle,
      this.chapterNumber,
      this.chapterTitle,
      this.mode,
      this.estimatedDurationMinutes,
      this.playlist,
      "active",
      this.createdAt,
      new Date(),
      null,
      null,
      this.totalPausedSeconds,
    );
  }

  pause(): ReadingSession {
    if (this.status !== "active") {
      throw new DomainError(
        `Cannot pause a session in status '${this.status}'`,
        "INVALID_SESSION_TRANSITION",
      );
    }
    return new ReadingSession(
      this.id,
      this.userId,
      this.bookTitle,
      this.chapterNumber,
      this.chapterTitle,
      this.mode,
      this.estimatedDurationMinutes,
      this.playlist,
      "paused",
      this.createdAt,
      this.startedAt,
      null,
      new Date(),
      this.totalPausedSeconds,
    );
  }

  resume(): ReadingSession {
    if (this.status !== "paused") {
      throw new DomainError(
        `Cannot resume a session in status '${this.status}'`,
        "INVALID_SESSION_TRANSITION",
      );
    }
    const pausedSeconds = this.pausedAt
      ? Math.floor((Date.now() - this.pausedAt.getTime()) / 1000)
      : 0;
    return new ReadingSession(
      this.id,
      this.userId,
      this.bookTitle,
      this.chapterNumber,
      this.chapterTitle,
      this.mode,
      this.estimatedDurationMinutes,
      this.playlist,
      "active",
      this.createdAt,
      this.startedAt,
      null,
      null,
      this.totalPausedSeconds + pausedSeconds,
    );
  }

  complete(): ReadingSession {
    if (this.status !== "active" && this.status !== "paused") {
      throw new DomainError(
        `Cannot complete a session in status '${this.status}'`,
        "INVALID_SESSION_TRANSITION",
      );
    }
    return new ReadingSession(
      this.id,
      this.userId,
      this.bookTitle,
      this.chapterNumber,
      this.chapterTitle,
      this.mode,
      this.estimatedDurationMinutes,
      this.playlist,
      "completed",
      this.createdAt,
      this.startedAt,
      new Date(),
      null,
      this.totalPausedSeconds,
    );
  }

  interrupt(): ReadingSession {
    if (this.status !== "active" && this.status !== "paused") {
      throw new DomainError(
        `Cannot interrupt a session in status '${this.status}'`,
        "INVALID_SESSION_TRANSITION",
      );
    }
    return new ReadingSession(
      this.id,
      this.userId,
      this.bookTitle,
      this.chapterNumber,
      this.chapterTitle,
      this.mode,
      this.estimatedDurationMinutes,
      this.playlist,
      "interrupted",
      this.createdAt,
      this.startedAt,
      new Date(),
      null,
      this.totalPausedSeconds,
    );
  }
}
