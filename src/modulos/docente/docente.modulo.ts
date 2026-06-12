import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocenteEntidad } from './entidades/docente.entidad';
import { DocenteServicio } from './docente.servicio';
import { DocentesControlador } from './docentes.controlador';
import { UsuarioModulo } from '@/modulos/usuario/usuario.modulo';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocenteEntidad]),
    UsuarioModulo,
  ],
  controllers: [DocentesControlador],
  providers: [DocenteServicio],
  exports: [DocenteServicio],
})
export class DocenteModulo {}
