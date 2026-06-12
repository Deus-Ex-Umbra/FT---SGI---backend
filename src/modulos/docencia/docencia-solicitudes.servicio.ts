import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudMaterialDocenteEntidad } from './entidades/solicitud-material-docente.entidad';
import { DocenciaGruposServicio } from './docencia-grupos.servicio';
import { CrearSolicitudMaterialDto } from './dto/crear-solicitud-material.dto';

@Injectable()
export class DocenciaSolicitudesServicio {
  constructor(
    @InjectRepository(SolicitudMaterialDocenteEntidad)
    private readonly repoSolicitudes: Repository<SolicitudMaterialDocenteEntidad>,
    private readonly gruposServicio: DocenciaGruposServicio,
  ) {}

  async listarSolicitudesDocente(docenteUsuarioId: number) {
    return await this.repoSolicitudes.find({
      where: { docenteUsuario: { id: docenteUsuarioId } },
      relations: { grupo: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async crearSolicitud(docenteUsuarioId: number, dto: CrearSolicitudMaterialDto) {
    if (!dto.grupoId) {
      throw new ForbiddenException('Primero debes crear/seleccionar una materia.');
    }
    if (!dto.responsableEstudianteId) {
      throw new ForbiddenException('Debes seleccionar al estudiante responsable.');
    }

    const g = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, dto.grupoId);
    if (!g) {
      throw new ForbiddenException('La materia no existe o no pertenece al docente.');
    }

    const solicitud = this.repoSolicitudes.create({
      docenteUsuario: { id: docenteUsuarioId } as any,
      grupo: { id: g.id } as any,
      responsableEstudianteId: dto.responsableEstudianteId ?? null,
      detalle: dto.detalle?.trim() || null,
      estado: 'vacio',
    });

    return await this.repoSolicitudes.save(solicitud);
  }

  async obtenerSolicitudParaDocente(docenteUsuarioId: number, id: string) {
    const solicitud = await this.repoSolicitudes.findOne({
      where: { id, docenteUsuario: { id: docenteUsuarioId } },
      relations: { grupo: true },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    return solicitud;
  }

  async obtenerSolicitudPorId(id: string) {
    return await this.repoSolicitudes.findOne({ where: { id }, relations: { grupo: true } });
  }

  async aprobarPorDocente(docenteUsuarioId: number, id: string) {
    const solicitud = await this.obtenerSolicitudParaDocente(docenteUsuarioId, id);

    if (solicitud.estado !== 'en_revision' && solicitud.estado !== 'vacio') {
      throw new ForbiddenException('La solicitud no está en un estado aprobable por docente.');
    }

    solicitud.estado = 'aprobado_docente';
    solicitud.aprobadoDocenteAt = new Date();
    return await this.repoSolicitudes.save(solicitud);
  }

  async listarPendientesAlmacen() {
    return await this.repoSolicitudes.find({
      where: { estado: 'aprobado_docente' },
      relations: { grupo: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async aprobarPorAlmacen(id: string) {
    const solicitud = await this.repoSolicitudes.findOne({ where: { id }, relations: { grupo: true } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');

    if (solicitud.estado !== 'aprobado_docente') {
      throw new ForbiddenException('La solicitud no está pendiente de almacén.');
    }

    solicitud.estado = 'aprobado_almacen';
    solicitud.aprobadoAlmacenAt = new Date();
    return await this.repoSolicitudes.save(solicitud);
  }

  async rechazarPorAlmacen(id: string, motivo?: string | null) {
    const solicitud = await this.repoSolicitudes.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');

    if (solicitud.estado !== 'aprobado_docente') {
      throw new ForbiddenException('La solicitud no está pendiente de almacén.');
    }

    solicitud.estado = 'rechazado_almacen';
    solicitud.detalle = [solicitud.detalle, motivo?.trim() ? `Motivo rechazo almacén: ${motivo.trim()}` : null]
      .filter(Boolean)
      .join('\n');
    return await this.repoSolicitudes.save(solicitud);
  }
}
