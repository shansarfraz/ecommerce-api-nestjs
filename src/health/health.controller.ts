import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbOk = false;
    try {
      await this.ds.query('SELECT 1');
      dbOk = true;
    } catch {}
    const status = dbOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      services: { database: dbOk ? 'ok' : 'error' },
    };
  }
}
