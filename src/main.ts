import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModulo } from './app.modulo';
import { SeedServicio } from './seed.servicio';

const envBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

async function bootstrap() {
  const logger = new Logger('AppServer');
  const app = await NestFactory.create(AppModulo);
  const dataSource = app.get(DataSource);

  // Fallback schema bootstrap for environments without migrations/synchronize.
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS movimientos_materiales (
      id SERIAL PRIMARY KEY,
      id_lote INT NOT NULL REFERENCES lotes_materiales(id) ON DELETE CASCADE,
      tipo VARCHAR(20) NOT NULL,
      cantidad INT NOT NULL,
      motivo TEXT NOT NULL,
      referencia VARCHAR(120),
      fecha TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_movimientos_materiales_lote_fecha
    ON movimientos_materiales (id_lote, fecha DESC)
  `);

  if (envBool(process.env.SEED_ON_BOOT, false)) {
    const seedServicio = app.get(SeedServicio);
    await seedServicio.seedDemo();
  }

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log('========================================================');
  logger.log(`Servidor ejecutandose en: http://localhost:${port}`);
  logger.log('Base de datos conectada correctamente (TypeORM).');
  logger.log('========================================================');
}

bootstrap();
