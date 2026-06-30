import { IdGenerator } from '../../src/application/ports/application.port';

export class FakeIdGenerator implements IdGenerator {
  private ids: string[];
  private index = 0;

  constructor(ids: string[] = ['profile-id-1']) {
    this.ids = ids;
  }

  generate(): string {
    const id = this.ids[this.index] ?? `generated-id-${this.index}`;
    this.index += 1;
    return id;
  }
}
