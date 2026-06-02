import { randomUUID } from "crypto";

import { IdGeneratorPort } from "../../../ports/driven/IdGeneratorPort";

export class UuidGenerator implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
