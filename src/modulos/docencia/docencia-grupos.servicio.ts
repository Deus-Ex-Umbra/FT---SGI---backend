import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrupoMateriaDocenteEntidad, EstadoAprobacionGrupoDocencia } from './entidades/grupo-materia-docente.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { MateriaEntidad } from '@/modulos/prestamo/entidades/materia.entidad';
import { CrearGrupoMateriaDto } from './dto/crear-grupo-materia.dto';
import { CrearGrupoAdminDto } from './dto/crear-grupo-admin.dto';
import { ActualizarGrupoMateriaDto } from './dto/actualizar-grupo-materia.dto';

@Injectable()
export class DocenciaGruposServicio {
  constructor(
    @InjectRepository(GrupoMateriaDocenteEntidad)
    public readonly repoGrupos: Repository<GrupoMateriaDocenteEntidad>,
    @InjectRepository(DocenteEntidad)
    private readonly repoDocentes: Repository<DocenteEntidad>,
    @InjectRepository(Usuario)
    private readonly repoUsuarios: Repository<Usuario>,
    @InjectRepository(MateriaEntidad)
    private readonly materiasRepo: Repository<MateriaEntidad>,
  ) {}

  async enriquecerGruposConDocente(
    grupos: GrupoMateriaDocenteEntidad[],
  ): Promise<GrupoMateriaDocenteEntidad[]> {
    if (!grupos || grupos.length === 0) return grupos;

    const docenteUserIds = Array.from(
      new Set(grupos.map((g) => g.docenteUsuario?.id).filter(Boolean)),
    );

    if (docenteUserIds.length === 0) return grupos;

    const docentesInfo = await this.repoDocentes.find({
      where: docenteUserIds.map((id) => ({ usuario: { id } })),
      relations: ['usuario'],
    });

    const docentePorUsuarioId = new Map(
      docentesInfo
        .filter((d) => d.usuario?.id)
        .map((d) => [d.usuario!.id, d]),
    );

    for (const grupo of grupos) {
      if (grupo.docenteUsuario?.id) {
        const docente = docentePorUsuarioId.get(grupo.docenteUsuario.id);
        if (docente) {
          (grupo.docenteUsuario as any).nombre = docente.nombre;
          (grupo.docenteUsuario as any).apellido = docente.apellido;
        }
      }
    }

    return grupos;
  }

  async enriquecerGrupoConDocente(
    grupo: GrupoMateriaDocenteEntidad,
  ): Promise<GrupoMateriaDocenteEntidad> {
    if (!grupo) return grupo;
    const enriquecidos = await this.enriquecerGruposConDocente([grupo]);
    return enriquecidos[0];
  }

  normalizarCodigoMateria(valor: string): string {
    return String(valor ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  validarCodigoMateria(codigoMateria: string) {
    if (!codigoMateria) {
      throw new BadRequestException('El código de materia es requerido.');
    }
    if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigoMateria)) {
      throw new BadRequestException('Código de materia inválido. Usa formato tipo MAT100, TOP120, INF-101.');
    }
  }

  normalizarNombreMateria(valor: string) {
    return String(valor ?? '').trim();
  }

  normalizarGrupo(valor: string | number | null | undefined) {
    return String(valor ?? '').trim();
  }

  validarCodigoGrupo(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('El código del grupo es requerido.');
    }
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/i.test(codigo)) {
      throw new BadRequestException('El código del grupo es inválido. Usa letras, números o guiones (máx. 12).');
    }
  }

  normalizarIdEnteroPositivo(nombreCampo: string, valor: unknown): number {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${nombreCampo} debe ser un número entero válido.`);
    }
    return n;
  }

  normalizarEstudianteIds(estudianteIds: number[] | undefined | null): number[] {
    if (!Array.isArray(estudianteIds)) return [];
    return Array.from(
      new Set(
        estudianteIds
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v) && v > 0),
      ),
    );
  }

  asegurarGrupoAprobado(grupo: GrupoMateriaDocenteEntidad) {
    const estado = grupo.estadoAprobacion ?? 'aprobado';
    if (estado === 'aprobado') return;
    if (estado === 'rechazado') {
      throw new ForbiddenException('Este grupo fue rechazado por administración y no puede usarse hasta ser aprobado.');
    }
    throw new ForbiddenException('Este grupo está pendiente de aprobación administrativa.');
  }

  normalizarCodigosMateria(codigos: unknown): string[] {
    if (!Array.isArray(codigos)) return [];
    return Array.from(
      new Set(
        codigos
          .map((codigo) => String(codigo ?? '').trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }

  async obtenerCodigosMateriaAsignados(docenteUsuarioId: number): Promise<string[]> {
    const docente = await this.repoDocentes.findOne({
      where: { usuario: { id: docenteUsuarioId } },
    });
    if (!docente) {
      throw new NotFoundException('Perfil docente no encontrado.');
    }
    const asignadas = this.normalizarCodigosMateria(docente.materiasAsignadas);
    const materiaPrincipal = String(docente.materia ?? '').trim().toUpperCase();
    if (materiaPrincipal) asignadas.push(materiaPrincipal);
    return Array.from(new Set(asignadas));
  }

  async validarMateriaAsignadaParaDocente(docenteUsuarioId: number, codigoMateria: string) {
    const materiasAsignadas = await this.obtenerCodigosMateriaAsignados(docenteUsuarioId);
    if (materiasAsignadas.length === 0) {
      throw new ForbiddenException('No tienes materias asignadas. Solicita al administrador que te asigne materias primero.');
    }
    const normalizada = this.normalizarCodigoMateria(codigoMateria);
    if (!materiasAsignadas.includes(normalizada)) {
      throw new ForbiddenException(`La materia ${normalizada} no está asignada a tu perfil docente.`);
    }
  }

  parsearFechaCampoOpcional(nombreCampo: string, valor: unknown): Date | null {
    const texto = String(valor ?? '').trim();
    if (!texto) return null;
    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException(`${nombreCampo} es inválida.`);
    }
    return fecha;
  }

  validarRangoFechas(nombreRango: string, inicio: Date, fin: Date) {
    if (inicio.getTime() > fin.getTime()) {
      throw new BadRequestException(`La fecha de inicio de ${nombreRango} no puede ser mayor a la fecha de fin.`);
    }
  }

  validarRangoFechasOpcional(nombreRango: string, inicio: Date | null, fin: Date | null) {
    if (!inicio || !fin) return;
    this.validarRangoFechas(nombreRango, inicio, fin);
  }

  generarCodigoInscripcionAleatorio(longitud = 6): string {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < longitud; i++) {
      resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
  }

  async validarCodigoInscripcion(codigo: string, excluidoId?: string) {
    const code = String(codigo ?? '').trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('El código de inscripción es requerido.');
    }
    if (code.length < 4) {
      throw new BadRequestException('El código de inscripción debe tener al menos 4 caracteres.');
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      throw new BadRequestException('El código de inscripción debe ser alfanumérico (solo letras y números).');
    }
    const existente = await this.repoGrupos.findOne({ where: { codigoInscripcion: code } });
    if (existente && existente.id !== excluidoId) {
      throw new BadRequestException('El código de inscripción ya está en uso por otra materia.');
    }
  }

  async resolverDocenteUsuarioId(valor: unknown): Promise<number> {
    const id = this.normalizarIdEnteroPositivo('El ID del docente', valor);
    const usuario = await this.repoUsuarios.findOne({ where: { id } });
    if (usuario) {
      if (usuario.rol !== 'docente') {
        throw new BadRequestException('El usuario seleccionado no tiene rol docente.');
      }
      return usuario.id;
    }
    const docentePorId = await this.repoDocentes.findOne({ where: { id }, relations: { usuario: true } });
    if (docentePorId?.usuario?.id) {
      if (docentePorId.usuario.rol !== 'docente') {
        throw new BadRequestException('El usuario asociado al docente no tiene rol docente.');
      }
      return docentePorId.usuario.id;
    }
    throw new NotFoundException('Perfil docente no encontrado.');
  }

  async validarCodigoUnicoPorDocente(params: {
    docenteUsuarioId: number;
    codigoMateria: string;
    grupo: string;
    excluirId?: string;
  }) {
    const existente = await this.repoGrupos
      .createQueryBuilder('g')
      .where('g.docente_usuario_id = :docenteUsuarioId', { docenteUsuarioId: params.docenteUsuarioId })
      .andWhere('COALESCE(g.sigla, g.codigo_materia, g.materia) = :codigoMateria', { codigoMateria: params.codigoMateria })
      .andWhere("COALESCE(g.grupo, g.nombre_grupo, '') = :grupo", { grupo: params.grupo })
      .getOne();

    if (existente && existente.id !== params.excluirId) {
      throw new BadRequestException('Ya existe una materia con esa sigla y grupo.');
    }
  }

  async obtenerGrupoParaDocente(docenteUsuarioId: number, id: string, opciones?: { requiereAprobado?: boolean }) {
    const grupo = await this.repoGrupos.findOne({
      where: { id, docenteUsuario: { id: docenteUsuarioId } },
      relations: { docenteUsuario: true, aprobadoPorUsuario: true },
    });
    if (!grupo) throw new NotFoundException('Materia no encontrada.');
    if (opciones?.requiereAprobado) {
      this.asegurarGrupoAprobado(grupo);
    }
    return await this.enriquecerGrupoConDocente(grupo);
  }

  async obtenerGrupoPorId(id: string) {
    const grupo = await this.repoGrupos.findOne({
      where: { id },
      relations: { docenteUsuario: true, aprobadoPorUsuario: true },
    });
    if (!grupo) throw new NotFoundException('Materia no encontrada.');
    return await this.enriquecerGrupoConDocente(grupo);
  }

  async listarGrupos(docenteUsuarioId: number) {
    const grupos = await this.repoGrupos.find({
      where: { docenteUsuario: { id: docenteUsuarioId } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return await this.enriquecerGruposConDocente(grupos);
  }

  async listarMateriasAsignadas(docenteUsuarioId: number): Promise<Array<{ codigo: string; nombre: string | null }>> {
    const codigosAsignados = await this.obtenerCodigosMateriaAsignados(docenteUsuarioId);
    if (codigosAsignados.length === 0) return [];

    const grupos = await this.repoGrupos.find({ order: { createdAt: 'DESC', id: 'DESC' } });
    const nombrePorCodigo = new Map<string, string>();

    for (const grupo of grupos) {
      const codigo = this.normalizarCodigoMateria(String(grupo.sigla ?? grupo.codigoMateria ?? grupo.materia ?? ''));
      if (!codigo || !codigosAsignados.includes(codigo)) continue;
      const nombre = String(grupo.nombre ?? grupo.nombreMateria ?? '').trim();
      if (!nombre) continue;
      if (!nombrePorCodigo.has(codigo)) {
        nombrePorCodigo.set(codigo, nombre);
      }
    }

    return codigosAsignados.map((codigo) => ({
      codigo,
      nombre: nombrePorCodigo.get(codigo) ?? null,
    }));
  }

  async crearGrupo(docenteUsuarioId: number, dto: CrearGrupoMateriaDto) {
    const anyDto = dto as unknown as Record<string, unknown>;
    const materiaEntidad = dto.materiaId
      ? await this.materiasRepo.findOne({ where: { id: dto.materiaId } })
      : null;
    if (dto.materiaId && !materiaEntidad) {
      throw new BadRequestException('La materia proporcionada no existe.');
    }

    const sigla = this.normalizarCodigoMateria(
      String(materiaEntidad?.codigo ?? (dto as any).sigla ?? anyDto.codigoMateria ?? anyDto.materia ?? ''),
    );
    const nombre = this.normalizarNombreMateria(
      String(materiaEntidad?.nombre ?? (dto as any).nombre ?? anyDto.nombreMateria ?? ''),
    );
    const descripcionRaw = String(materiaEntidad?.descripcion ?? (dto as any).descripcion ?? '').trim();
    const descripcion = descripcionRaw || null;
    const grupo = this.normalizarGrupo(dto.grupo ?? dto.nombreGrupo ?? (anyDto.nombreGrupo as any));

    const fechaInicioInscripcion = this.parsearFechaCampoOpcional(
      'La fecha de inicio de inscripción',
      (dto as any).fechaInicioInscripcion,
    );
    const fechaFinInscripcion = this.parsearFechaCampoOpcional(
      'La fecha de fin de inscripción',
      (dto as any).fechaFinInscripcion,
    );

    this.validarCodigoMateria(sigla);
    await this.validarMateriaAsignadaParaDocente(docenteUsuarioId, sigla);
    if (!grupo) {
      throw new BadRequestException('El grupo de la materia es requerido.');
    }
    this.validarCodigoGrupo(grupo);
    this.validarRangoFechasOpcional('inscripción', fechaInicioInscripcion, fechaFinInscripcion);

    let codigoInscripcion = '';
    const inputCodigo = (dto as any).codigoInscripcion;
    if (inputCodigo !== undefined && inputCodigo !== null && String(inputCodigo).trim() !== '') {
      await this.validarCodigoInscripcion(inputCodigo);
      codigoInscripcion = String(inputCodigo).trim().toUpperCase();
    } else {
      codigoInscripcion = this.generarCodigoInscripcionAleatorio();
    }

    await this.validarCodigoUnicoPorDocente({
      docenteUsuarioId,
      codigoMateria: sigla,
      grupo,
    });

    const materia = this.repoGrupos.create({
      docenteUsuario: { id: docenteUsuarioId } as any,
      materia: sigla,
      materiaId: materiaEntidad?.id ?? (dto.materiaId ?? null),
      codigoMateria: sigla,
      sigla,
      nombreMateria: nombre || null,
      nombre: nombre || null,
      descripcion,
      codigoInscripcion,
      fechaInicioInscripcion,
      fechaFinInscripcion,
      duracionMateriaSemanas: 16,
      nombreGrupo: grupo,
      grupo,
      estadoAprobacion: 'pendiente',
      activo: true,
      solicitadoAt: new Date(),
      aprobadoAt: null,
      aprobadoPorUsuario: null,
      motivoRechazo: null,
      maxEstudiantesGrupo: dto.maxEstudiantesGrupo ?? 3,
      estudianteIds: this.normalizarEstudianteIds(dto.estudianteIds),
    });

    const guardado = await this.repoGrupos.save(materia);
    return await this.obtenerGrupoPorId(guardado.id);
  }

  async crearGrupoPorAdmin(adminUsuarioId: number, dto: CrearGrupoAdminDto) {
    const docenteUsuarioId = await this.resolverDocenteUsuarioId((dto as any).docenteUsuarioId);
    const anyDto = dto as unknown as Record<string, unknown>;
    const materiaEntidad = dto.materiaId
      ? await this.materiasRepo.findOne({ where: { id: dto.materiaId } })
      : null;
    if (dto.materiaId && !materiaEntidad) {
      throw new BadRequestException('La materia proporcionada no existe.');
    }

    const sigla = this.normalizarCodigoMateria(
      String(materiaEntidad?.codigo ?? (dto as any).sigla ?? anyDto.codigoMateria ?? anyDto.materia ?? ''),
    );
    const nombre = this.normalizarNombreMateria(
      String(materiaEntidad?.nombre ?? (dto as any).nombre ?? anyDto.nombreMateria ?? ''),
    );
    const descripcionRaw = String(materiaEntidad?.descripcion ?? (dto as any).descripcion ?? '').trim();
    const descripcion = descripcionRaw || null;
    const grupo = this.normalizarGrupo(dto.grupo ?? dto.nombreGrupo ?? (anyDto.nombreGrupo as any));
    const fechaInicioInscripcion = this.parsearFechaCampoOpcional(
      'La fecha de inicio de inscripción',
      (dto as any).fechaInicioInscripcion,
    );
    const fechaFinInscripcion = this.parsearFechaCampoOpcional('La fecha de fin de inscripción', (dto as any).fechaFinInscripcion);

    this.validarCodigoMateria(sigla);
    if (!grupo) {
      throw new BadRequestException('El grupo de la materia es requerido.');
    }
    this.validarCodigoGrupo(grupo);
    this.validarRangoFechasOpcional('inscripción', fechaInicioInscripcion, fechaFinInscripcion);

    let codigoInscripcion = '';
    const inputCodigo = (dto as any).codigoInscripcion;
    if (inputCodigo !== undefined && inputCodigo !== null && String(inputCodigo).trim() !== '') {
      await this.validarCodigoInscripcion(inputCodigo);
      codigoInscripcion = String(inputCodigo).trim().toUpperCase();
    } else {
      codigoInscripcion = this.generarCodigoInscripcionAleatorio();
    }

    await this.validarCodigoUnicoPorDocente({
      docenteUsuarioId,
      codigoMateria: sigla,
      grupo,
    });

    const materia = this.repoGrupos.create({
      docenteUsuario: { id: docenteUsuarioId } as any,
      materia: sigla,
      materiaId: materiaEntidad?.id ?? (dto.materiaId ?? null),
      codigoMateria: sigla,
      sigla,
      nombreMateria: nombre || null,
      nombre: nombre || null,
      descripcion,
      codigoInscripcion,
      fechaInicioInscripcion,
      fechaFinInscripcion,
      duracionMateriaSemanas: 16,
      nombreGrupo: grupo,
      grupo,
      estadoAprobacion: 'aprobado',
      activo: true,
      solicitadoAt: new Date(),
      aprobadoAt: new Date(),
      aprobadoPorUsuario: { id: adminUsuarioId } as any,
      motivoRechazo: null,
      maxEstudiantesGrupo: dto.maxEstudiantesGrupo ?? 3,
      estudianteIds: this.normalizarEstudianteIds(dto.estudianteIds),
    });

    const guardado = await this.repoGrupos.save(materia);
    return await this.obtenerGrupoPorId(guardado.id);
  }

  async editarGrupo(usuarioId: number, usuarioRol: string, id: string, dto: ActualizarGrupoMateriaDto) {
    let grupo: GrupoMateriaDocenteEntidad;
    if (usuarioRol === 'administrador') {
      grupo = await this.obtenerGrupoPorId(id);
    } else {
      grupo = await this.obtenerGrupoParaDocente(usuarioId, id);
    }
    const docenteUsuarioId = grupo.docenteUsuario?.id;
    const anyDto = dto as unknown as Record<string, unknown>;
    const materiaEntidad = dto.materiaId
      ? await this.materiasRepo.findOne({ where: { id: dto.materiaId } })
      : null;
    if (dto.materiaId && !materiaEntidad) {
      throw new BadRequestException('La materia proporcionada no existe.');
    }

    const sigla = this.normalizarCodigoMateria(
      String(
        materiaEntidad?.codigo ??
          (dto as any).sigla ??
          anyDto.codigoMateria ??
          grupo.sigla ??
          grupo.codigoMateria ??
          grupo.materia ??
          '',
      ),
    );
    const nombre = this.normalizarNombreMateria(
      String(
        materiaEntidad?.nombre ??
          (dto as any).nombre ??
          anyDto.nombreMateria ??
          grupo.nombre ??
          grupo.nombreMateria ??
          '',
      ),
    );

    const descripcionRaw =
      dto.descripcion !== undefined
        ? String((dto as any).descripcion ?? '').trim()
        : String(materiaEntidad?.descripcion ?? grupo.descripcion ?? '').trim();
    const descripcion = descripcionRaw || null;

    const nombreGrupo = dto.grupo !== undefined || dto.nombreGrupo !== undefined
      ? this.normalizarGrupo(dto.grupo ?? dto.nombreGrupo)
      : this.normalizarGrupo(grupo.grupo ?? grupo.nombreGrupo);

    const fechaInicioInscripcion = dto.fechaInicioInscripcion !== undefined
      ? this.parsearFechaCampoOpcional('La fecha de inicio de inscripción', dto.fechaInicioInscripcion)
      : (grupo.fechaInicioInscripcion ? new Date(grupo.fechaInicioInscripcion) : null);

    const fechaFinInscripcion = dto.fechaFinInscripcion !== undefined
      ? this.parsearFechaCampoOpcional('La fecha de fin de inscripción', dto.fechaFinInscripcion)
      : (grupo.fechaFinInscripcion ? new Date(grupo.fechaFinInscripcion) : null);

    this.validarCodigoMateria(sigla);
    await this.validarMateriaAsignadaParaDocente(docenteUsuarioId, sigla);
    if (!nombreGrupo) {
      throw new BadRequestException('El grupo de la materia es requerido.');
    }
    this.validarCodigoGrupo(nombreGrupo);
    this.validarRangoFechasOpcional('inscripción', fechaInicioInscripcion, fechaFinInscripcion);

    await this.validarCodigoUnicoPorDocente({
      docenteUsuarioId,
      codigoMateria: sigla,
      grupo: nombreGrupo,
      excluirId: grupo.id,
    });

    grupo.codigoMateria = sigla;
    grupo.sigla = sigla;
    grupo.nombreMateria = nombre || null;
    grupo.nombre = nombre || null;
    grupo.descripcion = descripcion;
    grupo.materia = sigla;
    grupo.materiaId = materiaEntidad?.id ?? (dto.materiaId ?? grupo.materiaId ?? null);

    if (dto.codigoInscripcion !== undefined) {
      const code = String(dto.codigoInscripcion ?? '').trim().toUpperCase();
      if (code === '') {
        grupo.codigoInscripcion = this.generarCodigoInscripcionAleatorio();
      } else {
        await this.validarCodigoInscripcion(code, grupo.id);
        grupo.codigoInscripcion = code;
      }
    }

    if (dto.maxEstudiantesGrupo !== undefined) {
      grupo.maxEstudiantesGrupo = dto.maxEstudiantesGrupo;
    }

    grupo.fechaInicioInscripcion = fechaInicioInscripcion;
    grupo.fechaFinInscripcion = fechaFinInscripcion;
    grupo.nombreGrupo = nombreGrupo;
    grupo.grupo = nombreGrupo;
    grupo.duracionMateriaSemanas = Number(grupo.duracionMateriaSemanas ?? 16);

    if (dto.activo !== undefined) {
      grupo.activo = dto.activo;
    }

    if (grupo.estadoAprobacion === 'rechazado') {
      grupo.estadoAprobacion = 'pendiente';
      grupo.solicitadoAt = new Date();
      grupo.aprobadoAt = null;
      grupo.aprobadoPorUsuario = null;
      grupo.motivoRechazo = null;
    }

    const guardado = await this.repoGrupos.save(grupo);
    return await this.obtenerGrupoPorId(guardado.id);
  }

  async eliminarGrupo(usuarioId: number, usuarioRol: string, id: string) {
    let grupo: GrupoMateriaDocenteEntidad;
    if (usuarioRol === 'administrador') {
      grupo = await this.obtenerGrupoPorId(id);
    } else {
      grupo = await this.obtenerGrupoParaDocente(usuarioId, id);
    }
    await this.repoGrupos.delete({ id: grupo.id });
  }

  async listarSolicitudesGrupo(estado: EstadoAprobacionGrupoDocencia = 'pendiente') {
    const grupos = await this.repoGrupos.find({
      where: { estadoAprobacion: estado },
      relations: { docenteUsuario: true, aprobadoPorUsuario: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return await this.enriquecerGruposConDocente(grupos);
  }

  async aprobarSolicitudGrupo(adminUsuarioId: number, grupoId: string) {
    const grupo = await this.obtenerGrupoPorId(grupoId);
    if (grupo.estadoAprobacion === 'aprobado') {
      return await this.enriquecerGrupoConDocente(grupo);
    }
    grupo.estadoAprobacion = 'aprobado';
    grupo.aprobadoAt = new Date();
    grupo.aprobadoPorUsuario = { id: adminUsuarioId } as any;
    grupo.motivoRechazo = null;
    const guardado = await this.repoGrupos.save(grupo);
    return await this.enriquecerGrupoConDocente(await this.obtenerGrupoPorId(guardado.id));
  }

  async rechazarSolicitudGrupo(adminUsuarioId: number, grupoId: string, motivo?: string | null) {
    const grupo = await this.obtenerGrupoPorId(grupoId);
    if (grupo.rechazos >= 1) {
      await this.repoGrupos.delete({ id: grupoId });
      grupo.estadoAprobacion = 'rechazado';
      grupo.motivoRechazo = 'Eliminado físicamente por reincidencia de rechazo';
      return await this.enriquecerGrupoConDocente(grupo);
    }
    grupo.estadoAprobacion = 'rechazado';
    grupo.aprobadoAt = new Date();
    grupo.aprobadoPorUsuario = { id: adminUsuarioId } as any;
    grupo.motivoRechazo = String(motivo ?? '').trim() || null;
    grupo.rechazos = (grupo.rechazos || 0) + 1;
    const guardado = await this.repoGrupos.save(grupo);
    return await this.enriquecerGrupoConDocente(await this.obtenerGrupoPorId(guardado.id));
  }
}
