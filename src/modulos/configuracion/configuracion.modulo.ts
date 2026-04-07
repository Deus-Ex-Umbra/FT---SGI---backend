import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ConfiguracionIAEntidad } from './entidades/configuracion-ia.entidad';
import { ConfiguracionControlador } from './configuracion.controlador';
import { ConfiguracionServicio } from './configuracion.servicio';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionIAEntidad, Usuario])],
  providers: [ConfiguracionServicio],
  controllers: [ConfiguracionControlador],
  exports: [ConfiguracionServicio, TypeOrmModule],
})
export class ConfiguracionModulo {}
