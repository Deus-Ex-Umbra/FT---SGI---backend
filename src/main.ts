import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModulo } from './app.modulo';
import { DataSource } from 'typeorm';
import { UsuarioServicio } from './modulos/usuario/usuario.servicio';

const esOrigenLocalPermitido = (origin: string | undefined): boolean => {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};

async function bootstrap() {
  const logger = new Logger('AppServer');
  const app = await NestFactory.create(AppModulo);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (esOrigenLocalPermitido(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS en desarrollo: ${origin}`), false);
    },
    credentials: true,
  });
  await app.init();
  await app.get(UsuarioServicio).ensureAdministrador();
  try {
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
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log('========================================================');
  logger.log(`Servidor ejecutandose en: http://localhost:${port}`);
  logger.log('Base de datos conectada correctamente (TypeORM).');
  logger.log('========================================================');
}

bootstrap();


