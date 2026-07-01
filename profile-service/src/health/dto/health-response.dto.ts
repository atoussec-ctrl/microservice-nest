import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Overall service status' })
  status!: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down'], description: 'PostgreSQL connectivity' })
  database!: string;
}
