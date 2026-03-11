import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthControlador } from './health.controlador';
import { UsuarioModulo } from './modulos/usuario/usuario.modulo';
import { AutenticacionModulo } from './modulos/autenticacion/autenticacion.modulo';
import { Usuario } from './modulos/usuario/usuario.entidad';
import { ActivoModulo } from './modulos/activo/activo.modulo';
import { ActivoFijo } from './modulos/activo/activo_fijo.entidad';
import { ItemActivo } from './modulos/activo/item_activo.entidad';
import { ContenedorMaterial } from './modulos/material/contenedor_material.entidad';
import { MaterialFungible } from './modulos/material/material_fungible.entidad';
import { LoteMaterial } from './modulos/material/lote_material.entidad';
import { MovimientoMaterial } from './modulos/material/movimiento_material.entidad';
import { MaterialModulo } from './modulos/material/material.modulo';
import { SeedServicio } from './seed.servicio';
import { PrestamoModulo } from './modulos/prestamo/prestamo.modulo';
import { PrestamoEntidad } from './modulos/prestamo/prestamo.entidad';
import { EstudianteEntidad } from './modulos/prestamo/estudiante.entidad';
import { DocenteEntidad } from './modulos/prestamo/docente.entidad';
import { AuditoriaEventoEntidad } from './modulos/auditoria/auditoria.entidad';
import { AuditoriaModulo } from './modulos/auditoria/auditoria.modulo';

const envBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        const synchronize = envBool(process.env.DB_SYNCHRONIZE, false);
        const logging = envBool(process.env.DB_LOGGING, false);

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            entities: [
              Usuario,
              ActivoFijo,
              ItemActivo,
              ContenedorMaterial,
              MaterialFungible,
              LoteMaterial,
              MovimientoMaterial,
              PrestamoEntidad,
              EstudianteEntidad,
              DocenteEntidad,
              AuditoriaEventoEntidad,
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
            ActivoFijo,
            ItemActivo,
            ContenedorMaterial,
            MaterialFungible,
            LoteMaterial,
            MovimientoMaterial,
            PrestamoEntidad,
            EstudianteEntidad,
            DocenteEntidad,
            AuditoriaEventoEntidad,
          ],
          synchronize,
          logging,
        };
      },
    }),
    UsuarioModulo,
    AutenticacionModulo,
    ActivoModulo,
    MaterialModulo,
    PrestamoModulo,
    AuditoriaModulo,
  ],
  controllers: [HealthControlador],
  providers: [SeedServicio],
})
export class AppModulo { }
