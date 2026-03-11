import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaEventoEntidad } from './auditoria.entidad';
import { AuditoriaServicio } from './auditoria.servicio';

@Module({
  imports: [TypeOrmModule.forFeature([AuditoriaEventoEntidad])],
  providers: [AuditoriaServicio],
  exports: [AuditoriaServicio, TypeOrmModule],
})
export class AuditoriaModulo {}
