import { v4 as uuidv4 } from 'uuid';

import { IdGeneratorPort } from '../../../ports/driven/IdGeneratorPort';

export class UuidGenerator implements IdGeneratorPort {
  generate(): string {
    return uuidv4();
  }
}
