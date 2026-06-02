import { EntityNotFoundError, InvalidValueError } from "../errors/DomainError";

export const CHAPTER_MOODS = ["tense", "calm", "action", "reflective"] as const;
export type ChapterMood = (typeof CHAPTER_MOODS)[number];

export interface ChapterMetadata {
  readonly number: number;
  readonly title: string;
  readonly wordCount: number;
  readonly mood: ChapterMood;
}

export class Book {
  private constructor(
    readonly id: string,
    readonly title: string,
    readonly author: string,
    readonly chaptersMetadata: readonly ChapterMetadata[],
  ) {}

  static create(
    id: string,
    title: string,
    author: string,
    chapters: ChapterMetadata[],
  ): Book {
    if (!title || title.trim().length === 0) {
      throw new InvalidValueError("title", "must not be empty");
    }
    if (!author || author.trim().length === 0) {
      throw new InvalidValueError("author", "must not be empty");
    }
    if (chapters.length === 0) {
      throw new InvalidValueError(
        "chapters",
        "book must have at least one chapter",
      );
    }
    const invalidChapter = chapters.find((c) => c.wordCount <= 0);
    if (invalidChapter) {
      throw new InvalidValueError(
        "wordCount",
        `chapter ${invalidChapter.number} has invalid word count: ${invalidChapter.wordCount}`,
      );
    }
    return new Book(id, title.trim(), author.trim(), chapters);
  }

  getChapter(number: number): ChapterMetadata {
    const chapter = this.chaptersMetadata.find((c) => c.number === number);
    if (!chapter) {
      throw new EntityNotFoundError("Chapter", `${this.title}#${number}`);
    }
    return chapter;
  }

  get totalWordCount(): number {
    return this.chaptersMetadata.reduce((sum, c) => sum + c.wordCount, 0);
  }
}
