import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../../src/health/health.controller';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';

describe('HealthController', () => {
  it('should_report_healthy_when_database_reachable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', database: 'up' });
  });

  it('should_throw_service_unavailable_when_database_unreachable', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    await expect(controller.check()).rejects.toMatchObject({
      response: { status: 'error', database: 'down' },
    });
  });
});
