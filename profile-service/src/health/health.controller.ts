import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../infrastructure/persistence/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness and database health',
    description:
      'Verifies PostgreSQL connectivity. GraphQL operations are available at `POST /graphql`.',
  })
  @ApiResponse({ status: 200, description: 'Service healthy', type: HealthResponseDto })
  @ApiResponse({ status: 503, description: 'Database unreachable' })
  async check(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}
