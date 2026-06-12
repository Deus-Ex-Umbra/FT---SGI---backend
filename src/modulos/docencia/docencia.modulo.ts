import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocenciaControlador } from './docencia.controlador';
import { DocenciaServicio } from './docencia.servicio';
import { DocenciaGruposServicio } from './docencia-grupos.servicio';
import { DocenciaSubgruposServicio } from './docencia-subgrupos.servicio';
import { DocenciaSolicitudesServicio } from './docencia-solicitudes.servicio';
import { DocenciaInscripcionesServicio } from './docencia-inscripciones.servicio';
import { GrupoMateriaDocenteEntidad } from './entidades/grupo-materia-docente.entidad';
import { SolicitudMaterialDocenteEntidad } from './entidades/solicitud-material-docente.entidad';
import { SubgrupoPrestamoDocenciaEntidad } from './entidades/subgrupo-prestamo-docencia.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { EnlaceFirmadoModulo } from '@/modulos/enlace-firmado/enlace-firmado.modulo';
import { MateriaEntidad } from '@/modulos/prestamo/entidades/materia.entidad';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GrupoMateriaDocenteEntidad,
      SolicitudMaterialDocenteEntidad,
      SubgrupoPrestamoDocenciaEntidad,
      EstudianteEntidad,
      DocenteEntidad,
      Usuario,
      MateriaEntidad,
    ]),
    EnlaceFirmadoModulo,
  ],
  controllers: [DocenciaControlador],
  providers: [
    DocenciaServicio,
    DocenciaGruposServicio,
    DocenciaSubgruposServicio,
    DocenciaSolicitudesServicio,
    DocenciaInscripcionesServicio,
  ],
  exports: [
    DocenciaServicio,
    DocenciaGruposServicio,
    DocenciaSubgruposServicio,
    DocenciaSolicitudesServicio,
    DocenciaInscripcionesServicio,
  ],
})
export class DocenciaModulo {}
