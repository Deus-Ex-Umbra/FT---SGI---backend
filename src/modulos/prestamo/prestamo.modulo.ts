import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestamoEntidad } from './entidades/prestamo.entidad';
import { EstudianteEntidad } from './entidades/estudiante.entidad';
import { DocenteEntidad } from './entidades/docente.entidad';
import { CanastaEstudianteEntidad } from './entidades/canasta_estudiante.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { LoteMaterial } from '@/modulos/material/entidades/lote_material.entidad';
import { MovimientoMaterial } from '@/modulos/material/entidades/movimiento_material.entidad';
import { MateriaEntidad } from './entidades/materia.entidad';
import { CarreraEntidad } from './entidades/carrera.entidad';
import { PrestamoServicio } from './prestamo.servicio';
import { PrestamoControlador } from './prestamo.controlador';

@Module({
  imports: [TypeOrmModule.forFeature([PrestamoEntidad, EstudianteEntidad, DocenteEntidad, CanastaEstudianteEntidad, ItemActivoFijo, LoteMaterial, MovimientoMaterial, MateriaEntidad, CarreraEntidad])],
  providers: [PrestamoServicio],
  controllers: [PrestamoControlador],
  exports: [PrestamoServicio, TypeOrmModule],
})
export class PrestamoModulo {}
