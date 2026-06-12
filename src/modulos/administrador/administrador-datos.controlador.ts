import { Controller, Post, Get, UseGuards, Header, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { SeedServicio } from '@/seed.servicio';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ConfiguracionIAEntidad } from '@/modulos/configuracion/entidades/configuracion-ia.entidad';
import { ConfiguracionRegistroEstudianteEntidad } from '@/modulos/configuracion/entidades/configuracion-registro-estudiante.entidad';

@Controller('administrador/datos')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
@Roles('administrador')
export class AdministradorDatosControlador {
  private readonly logger = new Logger(AdministradorDatosControlador.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly seedServicio: SeedServicio,
  ) {}

  @Post('seed')
  async ejecutarSeed() {
    this.logger.log('Ejecutando seed de base de datos desde panel de administrador.');
    await this.seedServicio.seedDemo();
    return { ok: true, message: 'Base de datos poblada con datos semilla correctamente.' };
  }

  @Post('limpiar')
  async limpiarBaseDatos() {
    this.logger.log('Iniciando limpieza de base de datos preservando administradores.');

    const admins = await this.dataSource.getRepository(Usuario).find({
      where: { rol: 'administrador' },
    });
    const adminIds = admins.map((a) => a.id);
    let configsIa: ConfiguracionIAEntidad[] = [];
    if (adminIds.length > 0) {
      configsIa = await this.dataSource.getRepository(ConfiguracionIAEntidad).find({
        where: { usuario: { id: In(adminIds) } },
        relations: ['usuario'],
      });
    }

    await this.dataSource.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await this.dataSource.query('CREATE SCHEMA public;');

    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (err) {
      this.logger.warn(`No se pudo crear/verificar extensión uuid-ossp: ${String(err)}`);
    }

    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch {}

    await this.dataSource.synchronize();

    const usuarioRepo = this.dataSource.getRepository(Usuario);
    for (const admin of admins) {
      await usuarioRepo.insert(admin);
    }

    const configIaRepo = this.dataSource.getRepository(ConfiguracionIAEntidad);
    for (const cfg of configsIa) {
      await configIaRepo.insert({
        id: cfg.id,
        geminiApiKey: cfg.geminiApiKey,
        geminiApiUrl: cfg.geminiApiUrl,
        usuario: { id: cfg.usuario.id } as any,
      });
    }

    const configRegistroRepo = this.dataSource.getRepository(ConfiguracionRegistroEstudianteEntidad);
    await configRegistroRepo.insert({
      id: 1,
      registroEstudianteHabilitado: true,
    });

    try {
      await this.dataSource.query(`SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE(max(id), 1)) FROM usuarios;`);
    } catch (err) {
      this.logger.warn(`No se pudo reajustar secuencia de usuarios: ${String(err)}`);
    }

    try {
      await this.dataSource.query(`SELECT setval(pg_get_serial_sequence('configuracion_ia', 'id'), COALESCE(max(id), 1)) FROM configuracion_ia;`);
    } catch (err) {
      this.logger.warn(`No se pudo reajustar secuencia de configuracion_ia: ${String(err)}`);
    }

    try {
      await this.dataSource.query(`SELECT setval(pg_get_serial_sequence('configuracion_registro_estudiante', 'id'), COALESCE(max(id), 1)) FROM configuracion_registro_estudiante;`);
    } catch (err) {
      this.logger.warn(`No se pudo reajustar secuencia de configuracion_registro_estudiante: ${String(err)}`);
    }

    return {
      ok: true,
      message: 'Base de datos limpiada correctamente. Se mantuvieron las cuentas de administrador.',
    };
  }

  @Get('estructura-sql')
  @Header('Content-Type', 'application/sql')
  @Header('Content-Disposition', 'attachment; filename="estructura_db.sql"')
  async obtenerEstructuraSql() {
    this.logger.log('Generando estructura SQL de la base de datos.');

    const originalCreateQueryRunner = this.dataSource.createQueryRunner;
    
    this.dataSource.createQueryRunner = (mode?: any) => {
      const qr = originalCreateQueryRunner.call(this.dataSource, mode);
      qr.getTables = async () => [];
      qr.getViews = async () => [];
      return qr;
    };

    try {
      const schemaBuilder = this.dataSource.driver.createSchemaBuilder();
      const log = await schemaBuilder.log();
      
      const queries = log.upQueries.map((q) => q.query + ';');
      
      const header = `-- =========================================================\n` +
                     `-- Estructura de Base de Datos Exportada\n` +
                     `-- Generada el: ${new Date().toISOString()}\n` +
                     `-- Servidor de origen: PostgreSQL\n` +
                     `-- =========================================================\n\n`;

      return header + queries.join('\n\n');
    } finally {
      this.dataSource.createQueryRunner = originalCreateQueryRunner;
    }
  }

  @Get('datos-sql')
  @Header('Content-Type', 'application/sql')
  @Header('Content-Disposition', 'attachment; filename="datos_db.sql"')
  async obtenerDatosSql() {
    const metodo = process.env.DB_EXPORT_METHOD || 'typeorm';
    
    if (metodo === 'pg_dump') {
      return this.exportarConPgDump();
    } else {
      return this.exportarConTypeORM();
    }
  }

  private async exportarConTypeORM(): Promise<string> {
    this.logger.log('Generando exportación de datos en formato SQL usando TypeORM (Nativo).');
    
    const entities = this.dataSource.entityMetadatas;
    const sortedTables: import('typeorm').EntityMetadata[] = [];
    const visited = new Set<string>();
    
    const visit = (metadata: import('typeorm').EntityMetadata) => {
      if (visited.has(metadata.tableName)) return;
      visited.add(metadata.tableName);
      for (const fk of metadata.foreignKeys) {
        if (fk.referencedEntityMetadata.tableName !== metadata.tableName) {
          visit(fk.referencedEntityMetadata);
        }
      }
      sortedTables.push(metadata);
    };

    for (const metadata of entities) {
      visit(metadata);
    }

    let sql = `-- =========================================================\n`;
    sql += `-- Datos Exportados (Método TypeORM)\n`;
    sql += `-- Generado el: ${new Date().toISOString()}\n`;
    sql += `-- =========================================================\n\n`;

    for (const metadata of sortedTables) {
      const tableName = metadata.tableName;
      const rows = await this.dataSource.query(`SELECT * FROM "${tableName}"`);
      
      if (rows.length === 0) continue;
      
      sql += `-- Datos de la tabla: ${tableName}\n`;
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map(val => {
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${values.join(', ')});\n`;
      }
      sql += '\n';
    }

    return sql;
  }

  private async exportarConPgDump(): Promise<string> {
    this.logger.log('Generando exportación de datos en formato SQL usando pg_dump.');

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const fs = require('fs');
    const execAsync = promisify(exec);

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || 5432;
    const dbUser = process.env.DB_USERNAME || 'postgres';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_DATABASE || 'siyp';

    const hardcodedPath = 'C:\\Users\\yang_\\Desktop\\Proyectos F.T. - SHC170\\pgsql\\bin\\pg_dump.exe';
    const pgDumpExe = process.env.PG_DUMP_PATH || (fs.existsSync(hardcodedPath) ? hardcodedPath : 'pg_dump');

    const env = { ...process.env, PGPASSWORD: dbPass };
    
    const customCmd = process.env.PG_DUMP_COMMAND;
    const isUrl = dbHost.startsWith('postgresql://') || dbHost.startsWith('postgres://');
    const cmd = customCmd || (isUrl
      ? `"${pgDumpExe}" -d "${dbHost}" --data-only --inserts --column-inserts`
      : `"${pgDumpExe}" -h ${dbHost} -p ${dbPort} -U "${dbUser}" -d "${dbName}" --data-only --inserts --column-inserts`);

    try {
      const { stdout } = await execAsync(cmd, { env, maxBuffer: 1024 * 1024 * 50 }); // buffer de 50MB
      return stdout;
    } catch (error: any) {
      this.logger.error(`Error al ejecutar pg_dump: ${error.message}`);
      throw new Error(`Error al exportar los datos usando pg_dump. Verifica que tengas el ejecutable instalado o usa el método de TypeORM.`);
    }
  }
}
