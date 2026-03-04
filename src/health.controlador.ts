import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthControlador {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
