import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SubgrupoPrestamoDocenciaEntidad } from './entidades/subgrupo-prestamo-docencia.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenciaGruposServicio } from './docencia-grupos.servicio';

@Injectable()
export class DocenciaSubgruposServicio {
  constructor(
    @InjectRepository(SubgrupoPrestamoDocenciaEntidad)
    private readonly repoSubgruposPrestamo: Repository<SubgrupoPrestamoDocenciaEntidad>,
    @InjectRepository(EstudianteEntidad)
    private readonly repoEstudiantes: Repository<EstudianteEntidad>,
    private readonly gruposServicio: DocenciaGruposServicio,
  ) {}

  private normalizarCodigoSubgrupo(valor: string | number | null | undefined): string {
    return String(valor ?? '').trim().toUpperCase();
  }

  private normalizarIdEnteroPositivo(nombreCampo: string, valor: unknown): number {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${nombreCampo} debe ser un número entero válido.`);
    }
    return n;
  }

  private normalizarIdsEstudiantesSubgrupo(valor: unknown): number[] {
    if (!Array.isArray(valor)) return [];
    return Array.from(
      new Set(
        valor
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    );
  }

  private validarCodigoSubgrupo(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('El código del subgrupo es requerido.');
    }
    if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(codigo)) {
      throw new BadRequestException('El código del subgrupo es inválido. Usa letras, números o guiones (máx. 20).');
    }
  }

  private async validarMiembrosSubgrupo(params: {
    grupo: any;
    estudianteIds: number[];
    responsableEstudianteId: number;
  }) {
    const estudiantesGrupo = new Set(this.gruposServicio.normalizarEstudianteIds(params.grupo.estudianteIds));

    if (params.estudianteIds.length < 1) {
      throw new BadRequestException('El subgrupo debe incluir al menos un estudiante.');
    }

    const maxPorGrupo = params.grupo.maxEstudiantesGrupo ?? 3;
    if (params.estudianteIds.length > maxPorGrupo) {
      throw new BadRequestException(`El subgrupo no puede incluir más de ${maxPorGrupo} estudiantes.`);
    }

    for (const estudianteId of params.estudianteIds) {
      if (!estudiantesGrupo.has(estudianteId)) {
        throw new BadRequestException('Solo puedes asignar estudiantes inscritos en este grupo de materia.');
      }
    }

    if (!params.estudianteIds.includes(params.responsableEstudianteId)) {
      throw new BadRequestException('El responsable debe formar parte del subgrupo.');
    }

    const encontrados = await this.repoEstudiantes.find({
      where: params.estudianteIds.map((id) => ({ id })),
      select: { id: true },
    });

    if (encontrados.length !== params.estudianteIds.length) {
      throw new BadRequestException('Uno o más estudiantes del subgrupo no existen.');
    }
  }

  async listarSubgruposPrestamo(usuarioId: number, grupoId: string, rol?: string) {
    let subgrupos: SubgrupoPrestamoDocenciaEntidad[] = [];
    if (rol === 'estudiante') {
      const estudiante = await this.repoEstudiantes.findOne({ where: { usuario: { id: usuarioId } } });
      if (!estudiante) return [];
      subgrupos = await this.repoSubgruposPrestamo.find({
        where: { grupoMateria: { id: grupoId }, responsableEstudianteId: estudiante.id },
        order: { codigo: 'ASC', id: 'ASC' },
      });
    } else {
      const grupo = await this.gruposServicio.obtenerGrupoParaDocente(usuarioId, grupoId, { requiereAprobado: true });
      subgrupos = await this.repoSubgruposPrestamo.find({
        where: { grupoMateria: { id: grupo.id } },
        order: { codigo: 'ASC', id: 'ASC' },
      });
    }

    const todosEstudianteIds = Array.from(new Set(subgrupos.flatMap(s => s.estudianteIds || [])));
    const estudiantes = todosEstudianteIds.length > 0 
      ? await this.repoEstudiantes.find({ where: { id: In(todosEstudianteIds) } })
      : [];
    
    const estudiantesMap = new Map(estudiantes.map(e => [e.id, { id: e.id, carnet: e.carnet, nombre: e.nombre, apellido: e.apellido }]));

    return subgrupos.map(s => ({
      ...s,
      estudiantesDetalles: (s.estudianteIds || []).map(id => estudiantesMap.get(id)).filter(Boolean)
    }));
  }

  async listarMateriasLideradas(usuarioId: number) {
    const estudiante = await this.repoEstudiantes.findOne({ where: { usuario: { id: usuarioId } } });
    if (!estudiante) return [];

    const subgrupos = await this.repoSubgruposPrestamo.find({
      where: { responsableEstudianteId: estudiante.id },
      relations: ['grupoMateria', 'grupoMateria.docenteUsuario'],
    });

    const gruposMap = new Map();
    for (const subgrupo of subgrupos) {
      if (!gruposMap.has(subgrupo.grupoMateria.id)) {
        gruposMap.set(subgrupo.grupoMateria.id, subgrupo.grupoMateria);
      }
    }
    
    return await this.gruposServicio.enriquecerGruposConDocente(Array.from(gruposMap.values()));
  }

  async crearSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, dto: {
    codigo: string;
    nombre?: string | null;
    descripcion?: string | null;
    estudianteIds?: number[] | null;
    responsableEstudianteId?: number | null;
  }) {
    const grupo = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, grupoId, { requiereAprobado: true });
    const codigo = this.normalizarCodigoSubgrupo(dto.codigo);
    this.validarCodigoSubgrupo(codigo);
    const estudianteIds = this.normalizarIdsEstudiantesSubgrupo(dto.estudianteIds);
    const responsableEstudianteId = this.normalizarIdEnteroPositivo(
      'El responsable del subgrupo',
      dto.responsableEstudianteId,
    );

    await this.validarMiembrosSubgrupo({
      grupo,
      estudianteIds,
      responsableEstudianteId,
    });

    const existente = await this.repoSubgruposPrestamo.findOne({
      where: { grupoMateria: { id: grupo.id }, codigo },
    });
    if (existente) {
      throw new BadRequestException('Ya existe un subgrupo con ese código en este grupo.');
    }

    const subgrupo = this.repoSubgruposPrestamo.create({
      grupoMateria: { id: grupo.id } as any,
      codigo,
      nombre: String(dto.nombre ?? '').trim() || null,
      descripcion: String(dto.descripcion ?? '').trim() || null,
      estudianteIds,
      responsableEstudianteId,
      habilitado: true,
    });

    return await this.repoSubgruposPrestamo.save(subgrupo);
  }

  async editarSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, subgrupoId: string, dto: {
    codigo?: string;
    nombre?: string | null;
    descripcion?: string | null;
    habilitado?: boolean;
    estudianteIds?: number[] | null;
    responsableEstudianteId?: number | null;
  }) {
    const grupo = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, grupoId, { requiereAprobado: true });
    const subgrupo = await this.repoSubgruposPrestamo.findOne({
      where: { id: subgrupoId, grupoMateria: { id: grupo.id } },
    });
    if (!subgrupo) {
      throw new NotFoundException('Subgrupo no encontrado.');
    }

    if (dto.codigo !== undefined) {
      const codigo = this.normalizarCodigoSubgrupo(dto.codigo);
      this.validarCodigoSubgrupo(codigo);

      if (codigo !== subgrupo.codigo) {
        const existente = await this.repoSubgruposPrestamo.findOne({
          where: { grupoMateria: { id: grupo.id }, codigo },
        });
        if (existente && existente.id !== subgrupo.id) {
          throw new BadRequestException('Ya existe un subgrupo con ese código en este grupo.');
        }
      }
      subgrupo.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      subgrupo.nombre = String(dto.nombre ?? '').trim() || null;
    }

    if (dto.descripcion !== undefined) {
      subgrupo.descripcion = String(dto.descripcion ?? '').trim() || null;
    }

    const debeActualizarMiembros = dto.estudianteIds !== undefined || dto.responsableEstudianteId !== undefined;
    if (debeActualizarMiembros) {
      const estudianteIds = dto.estudianteIds !== undefined
        ? this.normalizarIdsEstudiantesSubgrupo(dto.estudianteIds)
        : this.normalizarIdsEstudiantesSubgrupo(subgrupo.estudianteIds);
      const responsableEstudianteId = dto.responsableEstudianteId !== undefined
        ? this.normalizarIdEnteroPositivo('El responsable del subgrupo', dto.responsableEstudianteId)
        : this.normalizarIdEnteroPositivo('El responsable del subgrupo', subgrupo.responsableEstudianteId);

      await this.validarMiembrosSubgrupo({
        grupo,
        estudianteIds,
        responsableEstudianteId,
      });

      subgrupo.estudianteIds = estudianteIds;
      subgrupo.responsableEstudianteId = responsableEstudianteId;
    }

    if (dto.habilitado !== undefined) {
      subgrupo.habilitado = !!dto.habilitado;
    }

    return await this.repoSubgruposPrestamo.save(subgrupo);
  }

  async eliminarSubgrupoPrestamo(docenteUsuarioId: number, grupoId: string, subgrupoId: string) {
    const grupo = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, grupoId, { requiereAprobado: true });
    const subgrupo = await this.repoSubgruposPrestamo.findOne({
      where: { id: subgrupoId, grupoMateria: { id: grupo.id } },
    });
    if (!subgrupo) {
      throw new NotFoundException('Subgrupo no encontrado.');
    }
    await this.repoSubgruposPrestamo.delete({ id: subgrupo.id });
    return { ok: true };
  }

  async generarSubgruposAlAzar(docenteUsuarioId: number, grupoId: string) {
    const grupo = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, grupoId, { requiereAprobado: true });
    const estudianteIds = this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds);
    if (estudianteIds.length === 0) {
      throw new BadRequestException('No hay estudiantes inscritos en esta materia.');
    }

    const estudiantesMezclados = [...estudianteIds];
    for (let i = estudiantesMezclados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [estudiantesMezclados[i], estudiantesMezclados[j]] = [estudiantesMezclados[j], estudiantesMezclados[i]];
    }

    const maxPorGrupo = grupo.maxEstudiantesGrupo ?? 3;
    const subgruposCreados: SubgrupoPrestamoDocenciaEntidad[] = [];
    let correlativo = 1;

    for (let i = 0; i < estudiantesMezclados.length; i += maxPorGrupo) {
      const chunk = estudiantesMezclados.slice(i, i + maxPorGrupo);
      let codigo = `G${correlativo}`;
      correlativo++;

      let existe = await this.repoSubgruposPrestamo.findOne({
        where: { grupoMateria: { id: grupo.id }, codigo },
      });
      while (existe) {
        codigo = `G${correlativo}`;
        correlativo++;
        existe = await this.repoSubgruposPrestamo.findOne({
          where: { grupoMateria: { id: grupo.id }, codigo },
        });
      }

      const subgrupo = this.repoSubgruposPrestamo.create({
        grupoMateria: { id: grupo.id } as any,
        codigo,
        nombre: `Grupo ${codigo}`,
        descripcion: 'Grupo generado al azar',
        estudianteIds: chunk,
        responsableEstudianteId: chunk[0],
        habilitado: true,
      });

      subgruposCreados.push(await this.repoSubgruposPrestamo.save(subgrupo));
    }

    return subgruposCreados;
  }

  async eliminarTodosSubgrupos(docenteUsuarioId: number, grupoId: string) {
    const grupo = await this.gruposServicio.obtenerGrupoParaDocente(docenteUsuarioId, grupoId, { requiereAprobado: true });
    await this.repoSubgruposPrestamo.delete({ grupoMateria: { id: grupo.id } });
    return { ok: true };
  }

  async actualizarCompanerosPorLider(usuarioId: number, subgrupoId: string, estudianteIds: number[]) {
    const estudianteLider = await this.repoEstudiantes.findOne({ where: { usuario: { id: usuarioId } } });
    if (!estudianteLider) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    const subgrupo = await this.repoSubgruposPrestamo.findOne({
      where: { id: subgrupoId },
      relations: { grupoMateria: true },
    });
    if (!subgrupo) {
      throw new NotFoundException('Grupo de préstamo no encontrado.');
    }

    if (subgrupo.responsableEstudianteId !== estudianteLider.id) {
      throw new ForbiddenException('Solo el estudiante responsable puede elegir o cambiar los compañeros.');
    }

    const cleanEstudianteIds = this.normalizarIdsEstudiantesSubgrupo(estudianteIds);

    if (!cleanEstudianteIds.includes(estudianteLider.id)) {
      cleanEstudianteIds.push(estudianteLider.id);
    }

    const grupo = subgrupo.grupoMateria;
    const maxPorGrupo = grupo.maxEstudiantesGrupo ?? 3;
    if (cleanEstudianteIds.length > maxPorGrupo) {
      throw new BadRequestException(`El grupo no puede exceder el límite de ${maxPorGrupo} estudiantes.`);
    }

    const estudiantesGrupo = new Set(this.gruposServicio.normalizarEstudianteIds(grupo.estudianteIds));
    for (const estId of cleanEstudianteIds) {
      if (!estudiantesGrupo.has(estId)) {
        throw new BadRequestException('Uno o más estudiantes no están inscritos en esta materia.');
      }
    }

    const otrosSubgrupos = await this.repoSubgruposPrestamo.find({
      where: { grupoMateria: { id: grupo.id } },
    });

    for (const estId of cleanEstudianteIds) {
      if (estId === estudianteLider.id) continue;
      const yaAsignado = otrosSubgrupos.some(
        (sub) => sub.id !== subgrupo.id && (sub.estudianteIds ?? []).includes(estId),
      );
      if (yaAsignado) {
        throw new BadRequestException(`El estudiante con ID ${estId} ya pertenece a otro grupo de préstamo.`);
      }
    }

    subgrupo.estudianteIds = cleanEstudianteIds;
    return await this.repoSubgruposPrestamo.save(subgrupo);
  }
}
