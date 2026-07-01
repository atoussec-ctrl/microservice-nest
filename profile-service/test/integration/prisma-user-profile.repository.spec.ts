import {
  PrismaOutboxRepository,
  PrismaUserProfileRepository,
} from '../../src/infrastructure/persistence/prisma-user-profile.repository';
import { UserProfile } from '../../src/domain/entities/user-profile.entity';
import { ProfileStatus } from '../../src/domain/enums/profile.enums';
import { DisplayName } from '../../src/domain/value-objects/display-name.vo';
import { Email } from '../../src/domain/value-objects/email.vo';
import { Username } from '../../src/domain/value-objects/username.vo';

function makeProfile(): UserProfile {
  const profile = UserProfile.create({
    id: 'p1',
    username: Username.create('alice'),
    email: Email.create('alice@example.com'),
    displayName: DisplayName.create('Alice'),
    now: new Date('2024-01-01T00:00:00.000Z'),
  });
  return profile;
}

describe('PrismaUserProfileRepository', () => {
  function makePrismaMock() {
    const tx = {
      userProfile: { upsert: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    return {
      tx,
      prisma: {
        $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<void>) =>
          cb(tx),
        ),
        userProfile: {
          findUnique: jest.fn(),
          count: jest.fn(),
        },
      },
    };
  }

  it('should_persist_aggregate_and_outbox_events_in_one_transaction', async () => {
    const { prisma, tx } = makePrismaMock();
    const repo = new PrismaUserProfileRepository(prisma as never);
    const profile = makeProfile();
    const events = profile.pullDomainEvents();

    await repo.save(profile, events);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userProfile.upsert).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('should_map_record_to_domain_on_findById', async () => {
    const { prisma } = makePrismaMock();
    prisma.userProfile.findUnique.mockResolvedValue({
      id: 'p1',
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: null,
      status: ProfileStatus.ACTIVE,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repo = new PrismaUserProfileRepository(prisma as never);
    const found = await repo.findById('p1');
    expect(found?.username.toString()).toBe('alice');
  });

  it('should_return_null_when_findById_misses', async () => {
    const { prisma } = makePrismaMock();
    prisma.userProfile.findUnique.mockResolvedValue(null);
    const repo = new PrismaUserProfileRepository(prisma as never);
    expect(await repo.findById('missing')).toBeNull();
  });

  it('should_report_existence_by_username_and_email', async () => {
    const { prisma } = makePrismaMock();
    prisma.userProfile.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const repo = new PrismaUserProfileRepository(prisma as never);
    expect(await repo.existsByUsername('alice')).toBe(true);
    expect(await repo.existsByEmail('none@example.com')).toBe(false);
    expect(prisma.userProfile.count).toHaveBeenCalledWith({
      where: { username: 'alice', status: { not: 'INACTIVE' } },
    });
  });
});

describe('PrismaOutboxRepository', () => {
  function makePrismaMock() {
    return {
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('should_map_pending_records', async () => {
    const prisma = makePrismaMock();
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        aggregateId: 'agg-1',
        type: 'PROFILE_CREATED',
        payload: { id: 'agg-1' },
        version: 1,
        status: 'PENDING',
        createdAt: new Date(),
        publishedAt: null,
      },
    ]);
    const repo = new PrismaOutboxRepository(prisma as never);
    const pending = await repo.findPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].aggregateId).toBe('agg-1');
  });

  it('should_mark_published', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaOutboxRepository(prisma as never);
    await repo.markPublished('e1', new Date());
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e1' } }),
    );
  });

  it('should_mark_failed', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaOutboxRepository(prisma as never);
    await repo.markFailed('e1');
    expect(prisma.outboxEvent.update).toHaveBeenCalled();
  });
});
