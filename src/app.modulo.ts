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
import { ContenedorMaterial } from './modulos/material/entidades/contenedor_material.entidad';
import { MaterialFungible } from './modulos/material/entidades/material_fungible.entidad';
import { LoteMaterial } from './modulos/material/entidades/lote_material.entidad';
import { MovimientoMaterial } from './modulos/material/entidades/movimiento_material.entidad';
import { MaterialModulo } from './modulos/material/material.modulo';
import { SeedServicio } from './seed.servicio';
import { PrestamoModulo } from './modulos/prestamo/prestamo.modulo';
import { PrestamoEntidad } from './modulos/prestamo/entidades/prestamo.entidad';
import { EstudianteEntidad } from './modulos/prestamo/entidades/estudiante.entidad';
import { DocenteEntidad } from './modulos/prestamo/entidades/docente.entidad';
import { CanastaEstudianteEntidad } from './modulos/prestamo/entidades/canasta_estudiante.entidad';
import { MateriaEntidad } from './modulos/prestamo/entidades/materia.entidad';
import { CarreraEntidad } from './modulos/prestamo/entidades/carrera.entidad';
import { ContenedorModulo } from './modulos/contenedor/contenedor.modulo';
import { ConfiguracionModulo } from './modulos/configuracion/configuracion.modulo';
import { GeminiModulo } from './modulos/gemini/gemini.modulo';
import { PdfModulo } from './modulos/pdf/pdf.modulo';
import { ReportesModulo } from './modulos/reportes/reportes.modulo';
import { ConfiguracionIAEntidad } from './modulos/configuracion/entidades/configuracion-ia.entidad';
import { ReporteEntidad } from './modulos/reportes/entidades/reporte.entidad';
import { ReportePdfEntidad } from './modulos/reportes/entidades/reporte-pdf.entidad';

const envBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
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
        const databaseUrl = process.env.DATABASE_URL;
        const synchronize = envBool(process.env.DB_SYNCHRONIZE, true);
        const logging = envBool(process.env.DB_LOGGING, false);

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            entities: [
              Usuario,
              ContenedorActivo,
              ActivoFijo,
              ItemActivoFijo,
              ActivoFungible,
              ItemActivoFungible,
              ContenedorMaterial,
              MaterialFungible,
              LoteMaterial,
              MovimientoMaterial,
              PrestamoEntidad,
              EstudianteEntidad,
              DocenteEntidad,
              CanastaEstudianteEntidad,
              MateriaEntidad,
              CarreraEntidad,
              ConfiguracionIAEntidad,
              ReporteEntidad,
              ReportePdfEntidad,
            ],
            synchronize,
            logging,
          };
        }

        return {
          type: 'postgres' as const,
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_DATABASE ?? 'siyp',
          entities: [
            Usuario,
            ContenedorActivo,
            ActivoFijo,
            ItemActivoFijo,
            ActivoFungible,
            ItemActivoFungible,
            ContenedorMaterial,
            MaterialFungible,
            LoteMaterial,
            MovimientoMaterial,
            PrestamoEntidad,
            EstudianteEntidad,
            DocenteEntidad,
            CanastaEstudianteEntidad,
            MateriaEntidad,
            CarreraEntidad,
            ConfiguracionIAEntidad,
            ReporteEntidad,
            ReportePdfEntidad,
          ],
          synchronize,
          logging,
        };
      },
    }),
    // Repositorios para SeedServicio (providers del módulo raíz).
    TypeOrmModule.forFeature([
      Usuario,
      ConfiguracionIAEntidad,
      ContenedorActivo,
      ActivoFijo,
      ItemActivoFijo,
      ActivoFungible,
      ItemActivoFungible,
      CarreraEntidad,
      MateriaEntidad,
      DocenteEntidad,
      EstudianteEntidad,
      PrestamoEntidad,
      CanastaEstudianteEntidad,
      ContenedorMaterial,
      MaterialFungible,
      LoteMaterial,
      MovimientoMaterial,
      ReporteEntidad,
      ReportePdfEntidad,
    ]),
    UsuarioModulo,
    AutenticacionModulo,
    ActivoModulo,
    MaterialModulo,
    PrestamoModulo,
    ContenedorModulo,
    ConfiguracionModulo,
    GeminiModulo,
    PdfModulo,
    ReportesModulo,
  ],
  controllers: [HealthControlador],
  providers: [SeedServicio],
})
export class AppModulo { }
