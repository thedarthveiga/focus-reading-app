import { Book } from '../../../domain/entities/Book';
import { EntityNotFoundError } from '../../../domain/errors/DomainError';
import { BookRepositoryPort } from '../../../ports/driven/BookRepositoryPort';

export class InMemoryBookRepository implements BookRepositoryPort {
  private store = new Map<string, Book>();

  constructor(initialBooks: Book[] = []) {
    initialBooks.forEach(b => this.store.set(b.id, b));
  }

  findById(id: string): Promise<Book> {
    const book = this.store.get(id);
    if (!book) throw new EntityNotFoundError('Book', id);
    return Promise.resolve(book);
  }

  findByTitle(title: string): Promise<Book[]> {
    const lower = title.toLowerCase();
    return Promise.resolve(
      [...this.store.values()].filter(b => b.title.toLowerCase().includes(lower)),
    );
  }

  save(book: Book): Promise<void> {
    this.store.set(book.id, book);
    return Promise.resolve();
  }
}
