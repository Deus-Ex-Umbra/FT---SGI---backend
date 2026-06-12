import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstudianteEntidad } from './entidades/estudiante.entidad';
import { EstudianteServicio } from './estudiante.servicio';
import { EstudianteConsultaServicio } from './estudiante-consulta.servicio';
import { EstudianteMutacionServicio } from './estudiante-mutacion.servicio';
import { EstudiantesControlador } from './estudiantes.controlador';
import { UsuarioModulo } from '@/modulos/usuario/usuario.modulo';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { CuEntidad } from './entidades/cu.entidad';
import { PrestamoModulo } from '@/modulos/prestamo/prestamo.modulo';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstudianteEntidad, CarreraEntidad, CuEntidad]),
    UsuarioModulo,
    forwardRef(() => PrestamoModulo),
  ],
  controllers: [EstudiantesControlador],
  providers: [EstudianteServicio, EstudianteConsultaServicio, EstudianteMutacionServicio],
  exports: [EstudianteServicio, EstudianteConsultaServicio, EstudianteMutacionServicio],
})
export class EstudianteModulo {}
