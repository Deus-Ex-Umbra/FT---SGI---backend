import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedServicio } from './seed.servicio';
import { SeedActivosServicio } from './seed-activos.servicio';
import { ActivoFijo } from './modulos/activo/entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './modulos/activo/entidades/item-activo-fijo.entidad';
import { EstudianteEntidad } from './modulos/estudiante/entidades/estudiante.entidad';
import { Usuario } from './modulos/usuario/entidades/usuario.entidad';
import { DocenteEntidad } from './modulos/docente/entidades/docente.entidad';
import { PrestamoEntidad } from './modulos/prestamo/entidades/prestamo.entidad';
import { InventarioEntidad } from './modulos/inventario/entidades/inventario.entidad';
import { CarreraEntidad } from './modulos/prestamo/entidades/carrera.entidad';
import { MateriaEntidad } from './modulos/prestamo/entidades/materia.entidad';
import { ActivoFungible } from './modulos/activo/entidades/activo-fungible.entidad';
import { ItemActivoFungible } from './modulos/activo/entidades/item-activo-fungible.entidad';
import { CuEntidad } from './modulos/estudiante/entidades/cu.entidad';
import { ContenedorActivo } from './modulos/contenedor/entidades/contenedor-activo.entidad';
import { EncargadoInventarioEntidad } from './modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { GrupoMateriaDocenteEntidad } from './modulos/docencia/entidades/grupo-materia-docente.entidad';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivoFijo,
      ItemActivoFijo,
      EstudianteEntidad,
      Usuario,
      DocenteEntidad,
      PrestamoEntidad,
      InventarioEntidad,
      CarreraEntidad,
      MateriaEntidad,
      ActivoFungible,
      ItemActivoFungible,
      CuEntidad,
      ContenedorActivo,
      EncargadoInventarioEntidad,
      GrupoMateriaDocenteEntidad,
    ]),
  ],
  providers: [SeedServicio, SeedActivosServicio],
  exports: [SeedServicio, SeedActivosServicio],
})
export class SeedModulo {}
