import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthControlador } from './health.controlador';
import { UsuarioModulo } from './modulos/usuario/usuario.modulo';
import { AutenticacionModulo } from './modulos/autenticacion/autenticacion.modulo';
import { Usuario } from './modulos/usuario/entidades/usuario.entidad';
import { ActivoModulo } from './modulos/activo/activo.modulo';
import { ContenedorActivo } from './modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoFijo } from './modulos/activo/entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './modulos/activo/entidades/item-activo-fijo.entidad';
import { ActivoFungible } from './modulos/activo/entidades/activo-fungible.entidad';
import { ItemActivoFungible } from './modulos/activo/entidades/item-activo-fungible.entidad';

import { SeedModulo } from './seed.modulo';
import { PrestamoModulo } from './modulos/prestamo/prestamo.modulo';
import { PrestamoEntidad } from './modulos/prestamo/entidades/prestamo.entidad';
import { HistorialPrestamoEntidad } from './modulos/prestamo/entidades/historial-prestamo.entidad';
import { EstudianteEntidad } from './modulos/estudiante/entidades/estudiante.entidad';
import { CuEntidad } from './modulos/estudiante/entidades/cu.entidad';
import { CanastaEstudianteEntidad } from './modulos/prestamo/entidades/canasta_estudiante.entidad';
import { CanastaPrestamoItemEntidad } from './modulos/prestamo/entidades/canasta-prestamo-item.entidad';
import { CarreraEntidad } from './modulos/prestamo/entidades/carrera.entidad';
import { MateriaEntidad } from './modulos/prestamo/entidades/materia.entidad';
import { ContenedorModulo } from './modulos/contenedor/contenedor.modulo';
import { ConfiguracionModulo } from './modulos/configuracion/configuracion.modulo';
import { GeminiModulo } from './modulos/gemini/gemini.modulo';
import { ReportesModulo } from './modulos/reportes/reportes.modulo';
import { ConfiguracionIAEntidad } from './modulos/configuracion/entidades/configuracion-ia.entidad';
import { ConfiguracionRegistroEstudianteEntidad } from './modulos/configuracion/entidades/configuracion-registro-estudiante.entidad';
import { ReporteEntidad } from './modulos/reportes/entidades/reporte.entidad';
import { DocenciaModulo } from './modulos/docencia/docencia.modulo';
import { GrupoMateriaDocenteEntidad } from './modulos/docencia/entidades/grupo-materia-docente.entidad';
import { SolicitudMaterialDocenteEntidad } from './modulos/docencia/entidades/solicitud-material-docente.entidad';
import { SubgrupoPrestamoDocenciaEntidad } from './modulos/docencia/entidades/subgrupo-prestamo-docencia.entidad';
import { EnlaceFirmadoModulo } from './modulos/enlace-firmado/enlace-firmado.modulo';
import { EnlaceFirmadoEntidad } from './modulos/enlace-firmado/entidades/enlace-firmado.entidad';
import { InventarioEntidad } from './modulos/inventario/entidades/inventario.entidad';
import { InventarioModulo } from './modulos/inventario/inventario.modulo';
import { AdministradorModulo } from './modulos/administrador/administrador.modulo';
import { EncargadoInventarioModulo } from './modulos/encargado-inventario/encargado-inventario.modulo';
import { DocenteModulo as RolesDocenteModulo } from './modulos/docente/docente.modulo';
import { EstudianteModulo } from './modulos/estudiante/estudiante.modulo';
import { DocenteEntidad } from './modulos/docente/entidades/docente.entidad';
import { EncargadoInventarioEntidad } from './modulos/encargado-inventario/entidades/encargado-inventario.entidad';

const envBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const entidadesTypeOrm = [
  Usuario,
  InventarioEntidad,
  ContenedorActivo,
  ActivoFijo,
  ItemActivoFijo,
  ActivoFungible,
  ItemActivoFungible,

  PrestamoEntidad,
  HistorialPrestamoEntidad,
  EstudianteEntidad,
  CuEntidad,
  CanastaEstudianteEntidad,
  CanastaPrestamoItemEntidad,
  CarreraEntidad,
  MateriaEntidad,
  ConfiguracionIAEntidad,
  ConfiguracionRegistroEstudianteEntidad,
  ReporteEntidad,
  GrupoMateriaDocenteEntidad,
  SolicitudMaterialDocenteEntidad,
  SubgrupoPrestamoDocenciaEntidad,
  EnlaceFirmadoEntidad,
  DocenteEntidad,
  EncargadoInventarioEntidad,
];

const parsePgUrl = (url: string) => {
  const withoutProtocol = url.replace(/^(postgresql|postgres):\/\//, '');
  const atIndex = withoutProtocol.lastIndexOf('@');
  let credentials = '';
  let hostAndPath = withoutProtocol;
  if (atIndex !== -1) {
    credentials = withoutProtocol.substring(0, atIndex);
    hostAndPath = withoutProtocol.substring(atIndex + 1);
  }

  let username = 'postgres';
  let password = '';
  if (credentials) {
    const colonIndex = credentials.indexOf(':');
    if (colonIndex !== -1) {
      username = credentials.substring(0, colonIndex);
      password = credentials.substring(colonIndex + 1);
    } else {
      username = credentials;
    }
  }

  const slashIndex = hostAndPath.indexOf('/');
  let hostInfo = hostAndPath;
  let pathAndOptions = '';
  if (slashIndex !== -1) {
    hostInfo = hostAndPath.substring(0, slashIndex);
    pathAndOptions = hostAndPath.substring(slashIndex + 1);
  }

  let host = hostInfo;
  let port = 5432;
  const colonIndexHost = hostInfo.lastIndexOf(':');
  if (colonIndexHost !== -1 && !hostInfo.includes(']')) {
    const portStr = hostInfo.substring(colonIndexHost + 1);
    if (/^\d+$/.test(portStr)) {
      host = hostInfo.substring(0, colonIndexHost);
      port = Number(portStr);
    }
  }

  let database = 'postgres';
  if (pathAndOptions) {
    const questionIndex = pathAndOptions.indexOf('?');
    let dbName = pathAndOptions;
    if (questionIndex !== -1) {
      dbName = pathAndOptions.substring(0, questionIndex);
    }
    if (dbName) {
      database = dbName;
    }
  }

  const safeDecode = (str: string) => {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  };

  return {
    host: safeDecode(host),
    port,
    username: safeDecode(username),
    password: safeDecode(password),
    database: safeDecode(database),
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: envBool(process.env.IGNORE_ENV_FILE, false),
      envFilePath: ['.env', '.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const synchronize = envBool(process.env.DB_SYNCHRONIZE, true);
        const logging = envBool(process.env.DB_LOGGING, false);
        const ssl = envBool(process.env.DB_SSL, false);

        const dbHost = process.env.DB_HOST ?? 'localhost';
        const isUrl = dbHost.startsWith('postgresql://') || dbHost.startsWith('postgres://');

        const dbConfig = isUrl ? parsePgUrl(dbHost) : {
          host: dbHost,
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_DATABASE ?? 'siyp',
        };

        return {
          type: 'postgres' as const,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: entidadesTypeOrm,
          synchronize,
          logging,
          ssl: ssl ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      Usuario,
      InventarioEntidad,
      ConfiguracionIAEntidad,
      ConfiguracionRegistroEstudianteEntidad,
      ContenedorActivo,
      ActivoFijo,
      ItemActivoFijo,
      ActivoFungible,
      ItemActivoFungible,
      CarreraEntidad,
      MateriaEntidad,
      EstudianteEntidad,
      CuEntidad,
      DocenteEntidad,
      PrestamoEntidad,
      CanastaEstudianteEntidad,
      CanastaPrestamoItemEntidad,

      ReporteEntidad,
      EnlaceFirmadoEntidad,
    ]),
    UsuarioModulo,
    AutenticacionModulo,
    ActivoModulo,

    PrestamoModulo,
    ContenedorModulo,
    ConfiguracionModulo,
    GeminiModulo,
    ReportesModulo,
    DocenciaModulo,
    EnlaceFirmadoModulo,
    InventarioModulo,
    AdministradorModulo,
    EncargadoInventarioModulo,
    RolesDocenteModulo,
    EstudianteModulo,
    SeedModulo,
  ],
  controllers: [HealthControlador],
  providers: [],
})
export class AppModulo { }
