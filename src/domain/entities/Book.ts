import { InvalidValueError } from "../errors/DomainError";

export class Book {
  private constructor(
    readonly id: string,
    readonly title: string,
    readonly chapterNumber: number,
    readonly chapterTitle: string | undefined,
  ) {}

  static create(
    id: string,
    title: string,
    chapterNumber: number,
    chapterTitle?: string,
  ): Book {
    if (!title || title.trim().length === 0) {
      throw new InvalidValueError("title", "must not be empty");
    }
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
      throw new InvalidValueError(
        "chapterNumber",
        "must be a positive integer",
      );
    }
    return new Book(id, title.trim(), chapterNumber, chapterTitle?.trim());
  }
}
