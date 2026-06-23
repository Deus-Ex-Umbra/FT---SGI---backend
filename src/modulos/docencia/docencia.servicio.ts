import { Injectable } from '@nestjs/common';
import { DocenciaGruposServicio } from './docencia-grupos.servicio';
import { DocenciaSubgruposServicio } from './docencia-subgrupos.servicio';
import { DocenciaSolicitudesServicio } from './docencia-solicitudes.servicio';
import { DocenciaInscripcionesServicio } from './docencia-inscripciones.servicio';
import { CrearGrupoMateriaDto } from './dto/crear-grupo-materia.dto';
import { CrearGrupoAdminDto } from './dto/crear-grupo-admin.dto';
import { ActualizarGrupoMateriaDto } from './dto/actualizar-grupo-materia.dto';
import { CrearSolicitudMaterialDto } from './dto/crear-solicitud-material.dto';
import { InscribirMateriaDto } from './dto/inscribir-materia.dto';
import { EstadoAprobacionGrupoDocencia } from './entidades/grupo-materia-docente.entidad';

@Injectable()
export class DocenciaServicio {
  constructor(
    private readonly gruposServicio: DocenciaGruposServicio,
    private readonly subgruposServicio: DocenciaSubgruposServicio,
    private readonly solicitudesServicio: DocenciaSolicitudesServicio,
    private readonly inscripcionesServicio: DocenciaInscripcionesServicio,
  ) {}

  async obtenerGrupoParaDocente(docenteUsuarioId: number, id: string, opciones?: { requiereAprobado?: boolean }) {
    return this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, id, opciones);
  }

  async obtenerGrupoPorId(id: string) {
    return this.gruposServicio.obtenerGrupoPorId(id);
  }

  async listarGrupos(docenteUsuarioId: number) {
    return this.gruposServicio.listarGrupos(docenteUsuarioId);
  }

  async listarMateriasAsignadas(docenteUsuarioId: number) {
    return this.gruposServicio.listarMateriasAsignadas(docenteUsuarioId);
  }

  async listarMateriasLideradas(usuarioId: number) {
    return this.subgruposServicio.listarMateriasLideradas(usuarioId);
  }

  async crearGrupo(docenteUsuarioId: number, dto: CrearGrupoMateriaDto) {
    return this.gruposServicio.crearGrupo(docenteUsuarioId, dto);
  }

  async crearGrupoPorAdmin(adminUsuarioId: number, dto: CrearGrupoAdminDto) {
    return this.gruposServicio.crearGrupoPorAdmin(adminUsuarioId, dto);
  }

  async editarGrupo(usuarioId: number, usuarioRol: string, id: string, dto: ActualizarGrupoMateriaDto) {
    return this.gruposServicio.editarGrupo(usuarioId, usuarioRol, id, dto);
  }

  async eliminarGrupo(usuarioId: number, usuarioRol: string, id: string) {
    return this.gruposServicio.eliminarGrupo(usuarioId, usuarioRol, id);
  }

  async listarSolicitudesGrupo(estado: EstadoAprobacionGrupoDocencia = 'pendiente') {
    return this.gruposServicio.listarSolicitudesGrupo(estado);
  }

  async aprobarSolicitudGrupo(adminUsuarioId: number, grupoId: string) {
    return this.gruposServicio.aprobarSolicitudGrupo(adminUsuarioId, grupoId);
  }

  async rechazarSolicitudGrupo(adminUsuarioId: number, grupoId: string, motivo?: string | null) {
    return this.gruposServicio.rechazarSolicitudGrupo(adminUsuarioId, grupoId, motivo);
  }

  async listarSubgruposPrestamo(docenteUsuarioId: number, grupoId: string, rol?: string) {
    return this.subgruposServicio.listarSubgruposPrestamo(docenteUsuarioId, grupoId, rol);
  }

  async crearSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, dto: {
    codigo: string;
    nombre?: string | null;
    descripcion?: string | null;
    estudianteIds?: number[] | null;
    responsableEstudianteId?: number | null;
  }) {
    return this.subgruposServicio.crearSubgrupoPrestamo(docenteUsuarioId, grupoId, dto);
  }

  async editarSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, subgrupoId: string, dto: {
    codigo?: string;
    nombre?: string | null;
    descripcion?: string | null;
    habilitado?: boolean;
    estudianteIds?: number[] | null;
    responsableEstudianteId?: number | null;
  }) {
    return this.subgruposServicio.editarSubgrupoPrestamo(docenteUsuarioId, grupoId, subgrupoId, dto);
  }

  async eliminarSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, subgrupoId: string) {
    return this.subgruposServicio.eliminarSubgrupoPrestamo(docenteUsuarioId, grupoId, subgrupoId);
  }

  async inscribirEstudianteMateria(id: string, payload: InscribirMateriaDto) {
    return this.inscripcionesServicio.inscribirEstudianteMateria(id, payload);
  }

  async listarSolicitudesDocente(docenteUsuarioId: number) {
    return this.solicitudesServicio.listarSolicitudesDocente(docenteUsuarioId);
  }

  async crearSolicitud(docenteUsuarioId: number, dto: CrearSolicitudMaterialDto) {
    return this.solicitudesServicio.crearSolicitud(docenteUsuarioId, dto);
  }

  async obtenerSolicitudParaDocente(docenteUsuarioId: number, id: string) {
    return this.solicitudesServicio.obtenerSolicitudParaDocente(docenteUsuarioId, id);
  }

  async obtenerSolicitudPorId(id: string) {
    return this.solicitudesServicio.obtenerSolicitudPorId(id);
  }

  async aprobarPorDocente(docenteUsuarioId: number, id: string) {
    return this.solicitudesServicio.aprobarPorDocente(docenteUsuarioId, id);
  }

  async listarPendientesAlmacen() {
    return this.solicitudesServicio.listarPendientesAlmacen();
  }

  async aprobarPorAlmacen(id: string) {
    return this.solicitudesServicio.aprobarPorAlmacen(id);
  }

  async rechazarPorAlmacen(id: string, motivo?: string | null) {
    return this.solicitudesServicio.rechazarPorAlmacen(id, motivo);
  }

  async inscribirEstudiantePorCodigo(usuarioId: number, codigo: string, carreras?: string[]) {
    return this.inscripcionesServicio.inscribirEstudiantePorCodigo(usuarioId, codigo, carreras);
  }

  async inscribirEstudiantePublicoPorCodigo(carnet: string, codigo: string, carreras?: string[]) {
    return this.inscripcionesServicio.inscribirEstudiantePublicoPorCodigo(carnet, codigo, carreras);
  }

  async generarSubgruposAlAzar(docenteUsuarioId: number, grupoId: string) {
    return this.subgruposServicio.generarSubgruposAlAzar(docenteUsuarioId, grupoId);
  }

  async eliminarTodosSubgrupos(docenteUsuarioId: number, grupoId: string) {
    return this.subgruposServicio.eliminarTodosSubgrupos(docenteUsuarioId, grupoId);
  }

  async listarEstudiantesInscritos(usuarioId: number, rol: string, grupoId: string) {
    return this.inscripcionesServicio.listarEstudiantesInscritos(usuarioId, rol, grupoId);
  }

  async actualizarCompanerosPorLider(usuarioId: number, subgrupoId: string, estudianteIds: number[]) {
    return this.subgruposServicio.actualizarCompanerosPorLider(usuarioId, subgrupoId, estudianteIds);
  }

  async desinscribirEstudiante(docenteUsuarioId: number, id: string, estudianteId: number, carrera?: string) {
    return this.inscripcionesServicio.desinscribirEstudianteMateria(docenteUsuarioId, id, estudianteId, carrera);
  }

  async desinscribirTodosEstudiantes(docenteUsuarioId: number, id: string) {
    return this.inscripcionesServicio.desinscribirTodosEstudiantesMateria(docenteUsuarioId, id);
  }
}
