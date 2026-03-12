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
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS contenedores_activos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      ubicacion VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL
    )
  `);
  await dataSource.query(`ALTER TABLE IF EXISTS activos_fijos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS activos_fijos ADD COLUMN IF NOT EXISTS id_contenedor INTEGER NULL`);
  await dataSource.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_activos_fijos_contenedor'
          AND table_name = 'activos_fijos'
      ) THEN
        ALTER TABLE activos_fijos
          ADD CONSTRAINT fk_activos_fijos_contenedor
          FOREIGN KEY (id_contenedor) REFERENCES contenedores_activos(id) ON DELETE SET NULL;
      END IF;
    END
    $$
  `);
  await dataSource.query(`ALTER TABLE IF EXISTS items_activos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS contenedores_materiales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS materiales_fungibles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS lotes_materiales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS estudiantes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS docentes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS prestamos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  await dataSource.query(`ALTER TABLE IF EXISTS prestamos ADD COLUMN IF NOT EXISTS grupo_canasta VARCHAR(80) NULL`);
  await dataSource.query(`
    UPDATE prestamos
    SET codigo_herramienta = id_item_activo::text
    WHERE id_item_activo IS NOT NULL
      AND deleted_at IS NULL
      AND codigo_herramienta <> id_item_activo::text
  `);
  await dataSource.query(`
    WITH prestamos_no_devueltos AS (
      SELECT
        id,
        codigo_herramienta,
        ROW_NUMBER() OVER (
          PARTITION BY codigo_herramienta
          ORDER BY fecha_prestamo DESC, id DESC
        ) AS rn
      FROM prestamos
      WHERE estado NOT IN ('devuelto', 'devuelto_fuera_de_fecha_limite')
        AND deleted_at IS NULL
    ), prestamos_duplicados AS (
      SELECT id
      FROM prestamos_no_devueltos
      WHERE rn > 1
    )
    UPDATE prestamos p
    SET
      deleted_at = NOW(),
      observaciones = CASE
        WHEN p.observaciones IS NULL OR BTRIM(p.observaciones) = ''
          THEN '[AUTO] Prestamo descartado por deduplicacion de item con multiples prestamos no devueltos.'
        ELSE p.observaciones || ' [AUTO] Prestamo descartado por deduplicacion de item con multiples prestamos no devueltos.'
      END
    FROM prestamos_duplicados d
    WHERE p.id = d.id
  `);
  await dataSource.query(`DROP INDEX IF EXISTS uq_prestamos_item_no_devuelto`);
  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_prestamos_item_no_devuelto
    ON prestamos (codigo_herramienta)
    WHERE estado NOT IN ('devuelto', 'devuelto_fuera_de_fecha_limite') AND deleted_at IS NULL
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_prestamos_grupo_canasta
    ON prestamos (grupo_canasta)
    WHERE grupo_canasta IS NOT NULL
  `);
  await dataSource.query(`DROP TRIGGER IF EXISTS trg_bloquear_update_auditoria_eventos ON auditoria_eventos`);
  await dataSource.query(`DROP TRIGGER IF EXISTS trg_bloquear_delete_auditoria_eventos ON auditoria_eventos`);
  await dataSource.query(`DROP FUNCTION IF EXISTS bloquear_update_delete_auditoria_eventos()`);
  await dataSource.query(`DROP INDEX IF EXISTS idx_auditoria_entidad_entidad_id`);
  await dataSource.query(`DROP INDEX IF EXISTS idx_auditoria_fecha`);
  await dataSource.query(`DROP TABLE IF EXISTS auditoria_eventos`);

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
