import { User } from "../../../domain/entities/User";
import { EntityNotFoundError } from "../../../domain/errors/DomainError";
import { UserRepositoryPort } from "../../../ports/driven/UserRepositoryPort";

export class InMemoryUserRepository implements UserRepositoryPort {
  private store = new Map<string, User>();

  constructor(initialUsers: User[] = []) {
    initialUsers.forEach((u) => this.store.set(u.id, u));
  }

  findById(id: string): Promise<User> {
    const user = this.store.get(id);
    if (!user) throw new EntityNotFoundError("User", id);
    return Promise.resolve(user);
  }

  save(user: User): Promise<void> {
    this.store.set(user.id, user);
    return Promise.resolve();
  }

  /** Test helper */
  size(): number {
    return this.store.size;
  }
}
