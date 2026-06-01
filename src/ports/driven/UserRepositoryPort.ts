import { User } from '../../domain/entities/User';

export interface UserRepositoryPort {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
}
