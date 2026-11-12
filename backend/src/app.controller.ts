import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      service: 'nest-expenses-api',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
    };
  }
}
