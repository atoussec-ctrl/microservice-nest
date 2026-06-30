import { Injectable } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { DomainEvent } from '../../domain/events/profile.events';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import {
  OutboxEventRecord,
  OutboxRepository,
  UserProfileRepository,
} from '../../domain/ports/repositories.port';
import { toDomainProfile, toPrismaStatus } from './profile.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(profile: UserProfile, events: DomainEvent[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({
        where: { id: profile.id },
        create: {
          id: profile.id,
          username: profile.username.toString(),
          email: profile.email.toString(),
          displayName: profile.displayName.toString(),
          avatarUrl: profile.avatarUrl,
          status: toPrismaStatus(profile.status),
          version: profile.version,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
        update: {
          displayName: profile.displayName.toString(),
          avatarUrl: profile.avatarUrl,
          status: toPrismaStatus(profile.status),
          version: profile.version,
          updatedAt: profile.updatedAt,
        },
      });

      for (const event of events) {
        await tx.outboxEvent.create({
          data: {
            aggregateId: event.aggregateId,
            type: event.type,
            payload: event.payload as unknown as Prisma.InputJsonValue,
            version: event.version,
            status: OutboxEventStatus.PENDING,
            createdAt: event.occurredAt,
          },
        });
      }
    });
  }

  async findById(id: string): Promise<UserProfile | null> {
    const record = await this.prisma.userProfile.findUnique({ where: { id } });
    return record ? toDomainProfile(record) : null;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.prisma.userProfile.count({ where: { username } });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.userProfile.count({ where: { email } });
    return count > 0;
  }
}

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPending(limit: number): Promise<OutboxEventRecord[]> {
    const records = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      aggregateId: r.aggregateId,
      type: r.type,
      payload: r.payload as Record<string, unknown>,
      version: r.version,
      status: r.status as OutboxEventRecord['status'],
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
    }));
  }

  async markPublished(id: string, publishedAt: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.PUBLISHED, publishedAt },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.FAILED },
    });
  }
}
