import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModulo } from './app.modulo';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const logger = new Logger('AppServer');

  const app = await NestFactory.create(AppModulo);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.init();

  // Log mínimo para confirmar a qué DB está conectada la app (sin exponer password).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = app.get(DataSource).options ?? {};
    if (opts.url) {
      const u = new URL(String(opts.url));
      const destino = `${u.protocol}//${u.username ? `${u.username}@` : ''}${u.host}${u.pathname}`;
      logger.log(`Conectado a DB: ${destino}`);
    } else {
      logger.log(
        `Conectado a DB: ${opts.host ?? ''}:${opts.port ?? ''}/${opts.database ?? ''} (user=${opts.username ?? ''})`,
      );
    }
  } catch {
    // no-op
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log('========================================================');
  logger.log(`Servidor ejecutandose en: http://localhost:${port}`);
  logger.log('Base de datos conectada correctamente (TypeORM).');
  logger.log('========================================================');
}

bootstrap();
