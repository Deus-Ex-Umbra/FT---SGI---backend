import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

const DB_NAMES_BLOQUEADOS = new Set(['postgres', 'template0', 'template1']);

async function main() {
  process.env.IGNORE_ENV_FILE = process.env.IGNORE_ENV_FILE ?? 'false';
  process.env.DB_SYNCHRONIZE = 'false';

  const logger = new Logger('DbResetRunner');

  const { AppModulo } = await import('./app.modulo');

  const app = await NestFactory.createApplicationContext(AppModulo, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    const opts: any = (ds as any).options ?? {};

    let database = String(opts.database ?? process.env.DB_DATABASE ?? '');
    let host = String(opts.host ?? process.env.DB_HOST ?? '');
    let port = String(opts.port ?? process.env.DB_PORT ?? '');
    let username = String(opts.username ?? process.env.DB_USERNAME ?? '');

    const dbHostEnv = process.env.DB_HOST ?? '';
    if (dbHostEnv.startsWith('postgresql://') || dbHostEnv.startsWith('postgres://')) {
      try {
        const parsedUrl = new URL(dbHostEnv);
        if (!database || database === 'postgres') {
          // If database is not set, or is the default postgres from URL, try pathname.
          // Sometimes user sets DB_DATABASE=siyp but URL database is postgres, let's prioritize DB_DATABASE.
          const urlDb = parsedUrl.pathname.substring(1);
          if (urlDb) database = urlDb;
        }
        if (host === dbHostEnv) host = parsedUrl.hostname;
        if (!port) port = parsedUrl.port;
        if (!username) username = parsedUrl.username;
      } catch (err) {
        // ignore
      }
    }

    if (!database) {
      throw new Error('No se pudo determinar DB_DATABASE; abortando reset.');
    }
    if (DB_NAMES_BLOQUEADOS.has(database)) {
      throw new Error(`Refusing to reset system database: ${database}`);
    }

    logger.warn(`LIMPIANDO DB: ${host}:${port}/${database} (user=${username})`);
    await ds.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await ds.query('CREATE SCHEMA public;');
    try {
      await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (err) {
      logger.warn(`No se pudo crear/verificar extension uuid-ossp: ${String(err)}`);
    }

    try {
      await ds.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch {
    }
    await ds.synchronize();

    logger.log('Base de datos limpia; esquema recreado correctamente.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[DbResetRunner] Error:', err);
  process.exitCode = 1;
});
