import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenciaGruposServicio } from './docencia-grupos.servicio';
import { InscribirMateriaDto } from './dto/inscribir-materia.dto';
import { SubgrupoPrestamoDocenciaEntidad } from './entidades/subgrupo-prestamo-docencia.entidad';

@Injectable()
export class DocenciaInscripcionesServicio {
  constructor(
    @InjectRepository(EstudianteEntidad)
    private readonly repoEstudiantes: Repository<EstudianteEntidad>,
    @InjectRepository(SubgrupoPrestamoDocenciaEntidad)
    private readonly repoSubgrupos: Repository<SubgrupoPrestamoDocenciaEntidad>,
    private readonly gruposServicio: DocenciaGruposServicio,
  ) {}

  async inscribirEstudianteMateria(id: string, payload: InscribirMateriaDto) {
    const carnet = String(payload?.carnet ?? '').trim();
    const estudianteIdRaw = Number(payload?.estudianteId ?? 0);

    let estudianteIdNum = 0;
    if (Number.isInteger(estudianteIdRaw) && estudianteIdRaw > 0) {
      estudianteIdNum = estudianteIdRaw;
    } else if (carnet) {
      const estudiante = await this.repoEstudiantes.findOne({ where: { carnet } });
      if (!estudiante) {
        throw new BadRequestException('No existe un estudiante con ese carnet.');
      }
      estudianteIdNum = estudiante.id;
    }

    if (!Number.isInteger(estudianteIdNum) || estudianteIdNum <= 0) {
      throw new BadRequestException('Debes indicar un estudiante válido (ID o carnet).');
    }

    const grupo = await this.gruposServicio.repoGrupos.findOne({ where: { id } });
    if (!grupo) throw new NotFoundException('Materia no encontrada.');
    this.gruposServicio.asegurarGrupoAprobado(grupo);

    const estudianteIds = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    if (estudianteIds.includes(estudianteIdNum)) {
      throw new BadRequestException('El estudiante ya está inscrito en la materia.');
    }

    grupo.estudianteIds = [...estudianteIds, estudianteIdNum];
    await this.gruposServicio.repoGrupos.save(grupo);

    return {
      ok: true,
      materiaId: grupo.id,
      inscritos: grupo.estudianteIds.length,
    };
  }

  async inscribirEstudiantePorCodigo(usuarioId: number, codigo: string, carrerasSeleccionadas?: string[]) {
    const normalizado = String(codigo ?? '').trim().toUpperCase();
    if (!normalizado) {
      throw new BadRequestException('El código de inscripción es requerido.');
    }

    const grupo = await this.gruposServicio.repoGrupos.findOne({ where: { codigoInscripcion: normalizado } });
    if (!grupo) {
      throw new NotFoundException('No se encontró ninguna materia con el código de inscripción proporcionado.');
    }
    this.gruposServicio.asegurarGrupoAprobado(grupo);

    if (grupo.permitirInscripcion === false) {
      throw new BadRequestException('La inscripción para esta materia está deshabilitada por el docente.');
    }

    const ahora = new Date();
    if (!grupo.fechaInicioInscripcion || !grupo.fechaFinInscripcion) {
      throw new BadRequestException('El docente de esta materia no ha configurado el periodo de inscripción.');
    }
    if (ahora < new Date(grupo.fechaInicioInscripcion)) {
      throw new BadRequestException('El periodo de inscripción para esta materia aún no ha comenzado.');
    }
    if (ahora > new Date(grupo.fechaFinInscripcion)) {
      throw new BadRequestException('El periodo de inscripción para esta materia ha finalizado.');
    }

    const estudiante = await this.repoEstudiantes.findOne({
      where: { usuario: { id: usuarioId } },
      relations: ['cus', 'cus.carreras', 'carreraRef'],
    });
    if (!estudiante) {
      throw new NotFoundException('No se encontró tu perfil de estudiante en el sistema.');
    }

    const asignaciones = estudiante.asignacionesCarrera || [];
    const carrerasEstudiante = asignaciones
      .map((a) => (typeof a.carrera === 'string' ? a.carrera : a.carrera?.nombre))
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '');
    if (carrerasEstudiante.length === 0 && estudiante.carrera) {
      carrerasEstudiante.push(String(estudiante.carrera).trim());
    }

    let carrerasAInscribir = carrerasEstudiante;
    if (carrerasSeleccionadas && carrerasSeleccionadas.length > 0) {
      carrerasAInscribir = carrerasSeleccionadas.filter(c => carrerasEstudiante.includes(c));
      if (carrerasAInscribir.length === 0) {
        throw new BadRequestException('Las carreras seleccionadas no son válidas para tu perfil.');
      }
    }

    const estudianteIds = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    let carrerasActuales: string[] = [];
    if (estudianteIds.includes(estudiante.id)) {
      carrerasActuales = grupo.carrerasPorEstudiante?.[estudiante.id] || carrerasEstudiante;
      
      const yaInscritasTodas = carrerasAInscribir.every(c => carrerasActuales.includes(c));
      if (yaInscritasTodas) {
        throw new BadRequestException('Ya estás inscrito en esta materia con las carreras seleccionadas.');
      }
    }

    if (!estudianteIds.includes(estudiante.id)) {
      grupo.estudianteIds = [...estudianteIds, estudiante.id];
    }

    if (!grupo.carrerasPorEstudiante) {
      grupo.carrerasPorEstudiante = {};
    }
    grupo.carrerasPorEstudiante[estudiante.id] = Array.from(new Set([...carrerasActuales, ...carrerasAInscribir]));

    await this.gruposServicio.repoGrupos.save(grupo);

    return {
      ok: true,
      materiaId: grupo.id,
      nombreMateria: grupo.nombre || grupo.nombreMateria || 'Materia',
      grupo: grupo.grupo || grupo.nombreGrupo || 'Sin grupo',
      inscritos: grupo.estudianteIds.length,
    };
  }

  async inscribirEstudiantePublicoPorCodigo(carnet: string, codigo: string, carrerasSeleccionadas?: string[]) {
    const normalizadoCodigo = String(codigo ?? '').trim().toUpperCase();
    const normalizadoCarnet = String(carnet ?? '').trim();

    if (!normalizadoCodigo) {
      throw new BadRequestException('El código de inscripción es requerido.');
    }
    if (!normalizadoCarnet) {
      throw new BadRequestException('El carnet del estudiante es requerido.');
    }

    const grupo = await this.gruposServicio.repoGrupos.findOne({ where: { codigoInscripcion: normalizadoCodigo } });
    if (!grupo) {
      throw new NotFoundException('No se encontró ninguna materia con el código de inscripción proporcionado.');
    }
    this.gruposServicio.asegurarGrupoAprobado(grupo);

    if (grupo.permitirInscripcion === false) {
      throw new BadRequestException('La inscripción para esta materia está deshabilitada por el docente.');
    }

    const ahora = new Date();
    if (!grupo.fechaInicioInscripcion || !grupo.fechaFinInscripcion) {
      throw new BadRequestException('El docente de esta materia no ha configurado el periodo de inscripción.');
    }
    if (ahora < new Date(grupo.fechaInicioInscripcion)) {
      throw new BadRequestException('El periodo de inscripción para esta materia aún no ha comenzado.');
    }
    if (ahora > new Date(grupo.fechaFinInscripcion)) {
      throw new BadRequestException('El periodo de inscripción para esta materia ha finalizado.');
    }

    const estudiante = await this.repoEstudiantes.findOne({
      where: { carnet: normalizadoCarnet },
      relations: ['cus', 'cus.carreras', 'carreraRef'],
    });
    if (!estudiante) {
      throw new BadRequestException('No existe ningún estudiante registrado con ese carnet.');
    }

    const asignaciones = estudiante.asignacionesCarrera || [];
    const carrerasEstudiante = asignaciones
      .map((a) => (typeof a.carrera === 'string' ? a.carrera : a.carrera?.nombre))
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '');
    if (carrerasEstudiante.length === 0 && estudiante.carrera) {
      carrerasEstudiante.push(String(estudiante.carrera).trim());
    }

    let carrerasAInscribir = carrerasEstudiante;
    if (carrerasSeleccionadas && carrerasSeleccionadas.length > 0) {
      carrerasAInscribir = carrerasSeleccionadas.filter(c => carrerasEstudiante.includes(c));
      if (carrerasAInscribir.length === 0) {
        throw new BadRequestException('Las carreras seleccionadas no son válidas para el perfil.');
      }
    }

    const estudianteIds = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    let carrerasActuales: string[] = [];
    if (estudianteIds.includes(estudiante.id)) {
      carrerasActuales = grupo.carrerasPorEstudiante?.[estudiante.id] || carrerasEstudiante;
      
      const yaInscritasTodas = carrerasAInscribir.every(c => carrerasActuales.includes(c));
      if (yaInscritasTodas) {
        throw new BadRequestException('El estudiante ya está inscrito en esta materia con las carreras seleccionadas.');
      }
    }

    if (!estudianteIds.includes(estudiante.id)) {
      grupo.estudianteIds = [...estudianteIds, estudiante.id];
    }

    if (!grupo.carrerasPorEstudiante) {
      grupo.carrerasPorEstudiante = {};
    }
    grupo.carrerasPorEstudiante[estudiante.id] = Array.from(new Set([...carrerasActuales, ...carrerasAInscribir]));

    await this.gruposServicio.repoGrupos.save(grupo);

    return {
      ok: true,
      materiaId: grupo.id,
      nombreMateria: grupo.nombre || grupo.nombreMateria || 'Materia',
      grupo: grupo.grupo || grupo.nombreGrupo || 'Sin grupo',
      inscritos: grupo.estudianteIds.length,
    };
  }

  async listarEstudiantesInscritos(usuarioId: number, rol: string, grupoId: string) {
    const grupo = await this.gruposServicio.repoGrupos.findOne({
      where: { id: grupoId },
      relations: ['docenteUsuario'],
    });
    if (!grupo) {
      throw new NotFoundException('Materia no encontrada.');
    }

    if (rol === 'estudiante') {
      const estudiante = await this.repoEstudiantes.findOne({ where: { usuario: { id: usuarioId } } });
      if (!estudiante) {
        throw new NotFoundException('Perfil de estudiante no encontrado.');
      }
      const inscritos = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
      if (!inscritos.includes(estudiante.id)) {
        throw new ForbiddenException('No estás inscrito en esta materia.');
      }
    } else if (rol === 'docente') {
      if (grupo.docenteUsuario?.id !== usuarioId) {
        throw new ForbiddenException('No tienes permiso para ver los estudiantes de esta materia.');
      }
    } else if (rol === 'administrador') {
    } else {
      throw new ForbiddenException('No tienes permisos para realizar esta acción.');
    }

    const inscritos = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    if (inscritos.length === 0) return [];
    
    const estudiantes = await this.repoEstudiantes.find({
      where: inscritos.map((id) => ({ id })),
      relations: ['carreraRef'],
      select: { id: true, nombre: true, apellido: true, carnet: true, carrera: true },
    });

    return estudiantes.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido,
      carnet: e.carnet,
      carrera: e.carreraRef?.nombre ?? e.carrera,
    }));
  }

  async desinscribirEstudianteMateria(docenteUsuarioId: number, id: string, estudianteId: number, carreraParaRemover?: string) {
    const grupo = await this.gruposServicio.repoGrupos.findOne({
      where: { id, docenteUsuario: { id: docenteUsuarioId } },
    });
    if (!grupo) throw new NotFoundException('Materia no encontrada.');

    const estudianteIds = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    if (!estudianteIds.includes(estudianteId)) {
      return { ok: true };
    }

    if (carreraParaRemover) {
      const estudiante = await this.repoEstudiantes.findOne({
        where: { id: estudianteId },
        relations: ['cus', 'cus.carreras', 'carreraRef'],
      });
      
      const asignaciones = estudiante?.asignacionesCarrera || [];
      const todasCarrerasEstudiante = asignaciones
        .map((a) => (typeof a.carrera === 'string' ? a.carrera : a.carrera?.nombre))
        .filter((c): c is string => typeof c === 'string' && c.trim() !== '');
      if (todasCarrerasEstudiante.length === 0 && estudiante?.carrera) {
        todasCarrerasEstudiante.push(String(estudiante.carrera).trim());
      }

      const carrerasActuales = grupo.carrerasPorEstudiante?.[estudianteId] || todasCarrerasEstudiante;
      const nuevasCarreras = carrerasActuales.filter(c => c !== carreraParaRemover);

      if (nuevasCarreras.length > 0) {
        if (!grupo.carrerasPorEstudiante) {
          grupo.carrerasPorEstudiante = {};
        }
        grupo.carrerasPorEstudiante[estudianteId] = nuevasCarreras;
        await this.gruposServicio.repoGrupos.save(grupo);
        return { ok: true };
      }
    }

    grupo.estudianteIds = estudianteIds.filter((id) => id !== estudianteId);
    if (grupo.carrerasPorEstudiante) {
      delete grupo.carrerasPorEstudiante[estudianteId];
    }
    await this.gruposServicio.repoGrupos.save(grupo);

    const subgrupos = await this.repoSubgrupos.find({
      where: { grupoMateria: { id: grupo.id } },
    });

    for (const subgrupo of subgrupos) {
      const ids = subgrupo.estudianteIds || [];
      if (ids.includes(estudianteId)) {
        const nuevosIds = ids.filter((i) => i !== estudianteId);
        if (nuevosIds.length === 0) {
          await this.repoSubgrupos.delete({ id: subgrupo.id });
        } else {
          subgrupo.estudianteIds = nuevosIds;
          if (subgrupo.responsableEstudianteId === estudianteId) {
            subgrupo.responsableEstudianteId = nuevosIds[0];
          }
          await this.repoSubgrupos.save(subgrupo);
        }
      }
    }

    return { ok: true };
  }

  async desinscribirTodosEstudiantesMateria(docenteUsuarioId: number, id: string) {
    const grupo = await this.gruposServicio.repoGrupos.findOne({
      where: { id, docenteUsuario: { id: docenteUsuarioId } },
    });
    if (!grupo) throw new NotFoundException('Materia no encontrada.');

    grupo.estudianteIds = [];
    grupo.carrerasPorEstudiante = null;
    await this.gruposServicio.repoGrupos.save(grupo);

    await this.repoSubgrupos.delete({ grupoMateria: { id: grupo.id } });

    return { ok: true };
  }
}
