import { NestFactory } from '@nestjs/core';
import { AppModulo } from './app.modulo';

async function bootstrap() {
  const app = await NestFactory.create(AppModulo);

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
