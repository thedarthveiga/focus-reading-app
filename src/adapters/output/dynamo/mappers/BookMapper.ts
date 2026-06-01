import { Book, ChapterMetadata, ChapterMood } from '../../../../domain/entities/Book';
import { Keys } from '../DynamoKeys';

export interface BookDynamoItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'BOOK';
  id: string;
  title: string;
  author: string;
  createdAt: string;
}

export interface ChapterDynamoItem {
  PK: string;
  SK: string;
  entityType: 'CHAPTER';
  bookId: string;
  number: number;
  title: string;
  wordCount: number;
  mood: ChapterMood;
}

export const BookMapper = {
  toBookItem(book: Book): BookDynamoItem {
    return {
      PK: Keys.book.pk(book.id),
      SK: Keys.book.sk(),
      GSI1PK: Keys.gsi1.bookTitlePk(),
      GSI1SK: Keys.gsi1.bookTitleSk(book.title),
      entityType: 'BOOK',
      id: book.id,
      title: book.title,
      author: book.author,
      createdAt: new Date().toISOString(),
    };
  },

  toChapterItems(book: Book): ChapterDynamoItem[] {
    return book.chaptersMetadata.map(ch => ({
      PK: Keys.book.pk(book.id),
      SK: Keys.book.chapterSk(ch.number),
      entityType: 'CHAPTER',
      bookId: book.id,
      number: ch.number,
      title: ch.title,
      wordCount: ch.wordCount,
      mood: ch.mood,
    }));
  },

  toDomain(bookItem: BookDynamoItem, chapterItems: ChapterDynamoItem[]): Book {
    const chapters: ChapterMetadata[] = chapterItems.map(ch => ({
      number: ch.number,
      title: ch.title,
      wordCount: ch.wordCount,
      mood: ch.mood,
    }));
    return Book.create(bookItem.id, bookItem.title, bookItem.author, chapters);
  },
};
