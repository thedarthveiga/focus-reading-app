import { ReadingSession } from "../../../domain/entities/ReadingSession";
import { EntityNotFoundError } from "../../../domain/errors/DomainError";
import { SessionRepositoryPort } from "../../../ports/driven/SessionRepositoryPort";

export class InMemorySessionRepository implements SessionRepositoryPort {
  private store = new Map<string, ReadingSession>();

  constructor(initialSessions: ReadingSession[] = []) {
    initialSessions.forEach((s) => this.store.set(s.id, s));
  }

  findById(id: string): Promise<ReadingSession> {
    const session = this.store.get(id);
    if (!session) throw new EntityNotFoundError("Session", id);
    return Promise.resolve(session);
  }

  save(session: ReadingSession): Promise<void> {
    this.store.set(session.id, session);
    return Promise.resolve();
  }

  size(): number {
    return this.store.size;
  }
}
