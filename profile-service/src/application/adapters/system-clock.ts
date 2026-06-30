import { randomUUID } from 'crypto';
import { Clock, IdGenerator } from '../ports/application.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
