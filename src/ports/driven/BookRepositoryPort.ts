import { Book } from '../../domain/entities/Book';

export interface BookRepositoryPort {
  findById(id: string): Promise<Book>;
  findByTitle(title: string): Promise<Book[]>;
  save(book: Book): Promise<void>;
}
