import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { EstudianteEntidad } from './estudiante.entidad';
import { DocenteEntidad } from './docente.entidad';
import { ItemActivo } from '../activo/item_activo.entidad';
import { LoteMaterial } from '../material/lote_material.entidad';
import { MovimientoMaterial } from '../material/movimiento_material.entidad';
import { PrestamoServicio } from './prestamo.servicio';
import { PrestamoControlador } from './prestamo.controlador';

@Module({
  imports: [TypeOrmModule.forFeature([PrestamoEntidad, EstudianteEntidad, DocenteEntidad, ItemActivo, LoteMaterial, MovimientoMaterial])],
  providers: [PrestamoServicio],
  controllers: [PrestamoControlador],
  exports: [PrestamoServicio, TypeOrmModule],
})
export class PrestamoModulo {}
