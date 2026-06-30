import { Clock } from '../../src/application/ports/application.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date = new Date('2024-01-01T00:00:00.000Z')) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = date;
  }
}
