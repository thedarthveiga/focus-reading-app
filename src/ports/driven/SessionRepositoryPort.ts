import { ReadingSession } from "../../domain/entities/ReadingSession";

export interface SessionRepositoryPort {
  findById(id: string): Promise<ReadingSession>;
  save(session: ReadingSession): Promise<void>;
}
