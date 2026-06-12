import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestamoEntidad } from './entidades/prestamo.entidad';
import { HistorialPrestamoEntidad } from './entidades/historial-prestamo.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { CuEntidad } from '@/modulos/estudiante/entidades/cu.entidad';
import { CanastaEstudianteEntidad } from './entidades/canasta_estudiante.entidad';
import { CanastaPrestamoItemEntidad } from './entidades/canasta-prestamo-item.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ItemActivoFungible } from '@/modulos/activo/entidades/item-activo-fungible.entidad';
import { CarreraEntidad } from './entidades/carrera.entidad';
import { MateriaEntidad } from './entidades/materia.entidad';
import { PrestamoServicio } from './prestamo.servicio';
import { CarreraServicio } from './carrera.servicio';
import { MateriaServicio } from './materia.servicio';
import { PrestamoCanastaServicio } from './prestamo-canasta.servicio';
import { PrestamoUtilServicio } from './prestamo-util.servicio';
import { PrestamoInitServicio } from './prestamo-init.servicio';
import { PrestamoControlador } from './prestamo.controlador';
import { CarrerasControlador } from './carreras.controlador';
import { MateriasControlador } from './materias.controlador';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { GrupoMateriaDocenteEntidad } from '@/modulos/docencia/entidades/grupo-materia-docente.entidad';
import { SubgrupoPrestamoDocenciaEntidad } from '@/modulos/docencia/entidades/subgrupo-prestamo-docencia.entidad';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrestamoEntidad,
      HistorialPrestamoEntidad,
      EncargadoInventarioEntidad,
      EstudianteEntidad,
      CuEntidad,
      Usuario,
      DocenteEntidad,
      CanastaEstudianteEntidad,
      CanastaPrestamoItemEntidad,
      ItemActivoFijo,
      ItemActivoFungible,
      GrupoMateriaDocenteEntidad,
      SubgrupoPrestamoDocenciaEntidad,
      CarreraEntidad,
      MateriaEntidad,
    ]),
  ],

  providers: [
    PrestamoServicio,
    CarreraServicio,
    MateriaServicio,
    PrestamoCanastaServicio,
    PrestamoUtilServicio,
    PrestamoInitServicio,
  ],
  controllers: [PrestamoControlador, CarrerasControlador, MateriasControlador],
  exports: [
    PrestamoServicio,
    CarreraServicio,
    MateriaServicio,
    PrestamoCanastaServicio,
    PrestamoUtilServicio,
    PrestamoInitServicio,
    TypeOrmModule,
  ],
})
export class PrestamoModulo {}
