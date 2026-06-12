import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnlaceFirmadoEntidad } from './entidades/enlace-firmado.entidad';
import { EnlaceFirmadoServicio } from './enlace-firmado.servicio';

@Module({
  imports: [TypeOrmModule.forFeature([EnlaceFirmadoEntidad])],
  providers: [EnlaceFirmadoServicio],
  exports: [EnlaceFirmadoServicio],
})
export class EnlaceFirmadoModulo {}
