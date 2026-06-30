import {
  SystemClock,
  UuidIdGenerator,
} from '../../../src/application/adapters/system-clock';

describe('SystemClock', () => {
  it('should_return_a_date_close_to_now', () => {
    const before = Date.now();
    const clock = new SystemClock();
    const now = clock.now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('UuidIdGenerator', () => {
  it('should_generate_unique_uuid_v4_strings', () => {
    const gen = new UuidIdGenerator();
    const a = gen.generate();
    const b = gen.generate();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(a).toMatch(uuidPattern);
    expect(b).toMatch(uuidPattern);
    expect(a).not.toBe(b);
  });
});
