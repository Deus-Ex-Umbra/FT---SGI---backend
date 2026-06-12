import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ConfiguracionIAEntidad } from './entidades/configuracion-ia.entidad';
import { ConfiguracionRegistroEstudianteEntidad } from './entidades/configuracion-registro-estudiante.entidad';
import { ConfiguracionControlador } from './configuracion.controlador';
import { ConfiguracionServicio } from './configuracion.servicio';
import { EnlaceFirmadoModulo } from '@/modulos/enlace-firmado/enlace-firmado.modulo';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfiguracionIAEntidad, Usuario, ConfiguracionRegistroEstudianteEntidad]),
    EnlaceFirmadoModulo,
  ],
  providers: [ConfiguracionServicio],
  controllers: [ConfiguracionControlador],
  exports: [ConfiguracionServicio, TypeOrmModule],
})
export class ConfiguracionModulo {}
