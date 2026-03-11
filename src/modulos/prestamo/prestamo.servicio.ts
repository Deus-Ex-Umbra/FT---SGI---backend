import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { EstudianteEntidad } from './estudiante.entidad';
import { DocenteEntidad } from './docente.entidad';
import { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import { LoteMaterial } from '../material/lote_material.entidad';
import { MovimientoMaterial } from '../material/movimiento_material.entidad';

@Injectable()
export class PrestamoServicio {
  constructor(
    @InjectRepository(PrestamoEntidad)
    private readonly prestamosRepo: Repository<PrestamoEntidad>,
    @InjectRepository(EstudianteEntidad)
    private readonly estudiantesRepo: Repository<EstudianteEntidad>,
    @InjectRepository(DocenteEntidad)
    private readonly docentesRepo: Repository<DocenteEntidad>,
    @InjectRepository(LoteMaterial)
    private readonly lotesRepo: Repository<LoteMaterial>,
    @InjectRepository(MovimientoMaterial)
    private readonly movimientosMaterialRepo: Repository<MovimientoMaterial>,
    private readonly auditoriaServicio: AuditoriaServicio,
  ) {}

  private estadoCalculado(estadoActual: string, fechaDevolucion: Date | null | undefined): 'pendiente' | 'devuelto' | 'vencido' {
    if (estadoActual === 'devuelto') return 'devuelto';
    if (!fechaDevolucion) return 'pendiente';
    return new Date(fechaDevolucion).getTime() < Date.now() ? 'vencido' : 'pendiente';
  }

  private mapPrestamoDto(p: PrestamoEntidad) {
    return {
      id: p.id,
      carnetEstudiante: p.estudiante?.carnet,
      idHerramienta: p.codigoHerramienta,
      idDocente: p.docente?.id,
      fechaPrestamo: p.fechaPrestamo,
      fechaDevolucion: p.fechaDevolucion,
      estado: p.estado,
      docente: p.docente ? `${p.docente.nombre} ${p.docente.apellido}` : '',
      observaciones: p.observaciones ?? '',
    };
  }

  private async marcarVencidosEnLote() {
    await this.prestamosRepo
      .createQueryBuilder()
      .update(PrestamoEntidad)
      .set({ estado: 'vencido' })
      .where('estado IN (:...estados)', { estados: ['pendiente', 'activo'] })
      .andWhere('fecha_devolucion IS NOT NULL')
      .andWhere('fecha_devolucion < NOW()')
      .execute();
  }

  private async sincronizarCarnetsRetenidosEnLote() {
    const estadosActivos = ['pendiente', 'vencido', 'activo'];

    await this.estudiantesRepo
      .createQueryBuilder()
      .update(EstudianteEntidad)
      .set({ carnetRetenido: true })
      .where('carnet_retenido = false')
      .andWhere(
        `id IN (
          SELECT DISTINCT p.id_estudiante
          FROM prestamos p
          WHERE p.estado IN (:...estadosActivos)
        )`,
        { estadosActivos },
      )
      .execute();

    await this.estudiantesRepo
      .createQueryBuilder()
      .update(EstudianteEntidad)
      .set({ carnetRetenido: false })
      .where('carnet_retenido = true')
      .andWhere(
        `id NOT IN (
          SELECT DISTINCT p.id_estudiante
          FROM prestamos p
          WHERE p.estado IN (:...estadosActivos)
        )`,
        { estadosActivos },
      )
      .execute();
  }

  private async sincronizarCarnetRetenidoEstudiante(idEstudiante: number) {
    const estudiante = await this.estudiantesRepo.findOne({ where: { id: idEstudiante } });
    if (!estudiante) return;

    const activos = await this.prestamosRepo
      .createQueryBuilder('p')
      .where('p.id_estudiante = :idEstudiante', { idEstudiante })
      .andWhere('p.estado IN (:...estados)', { estados: ['pendiente', 'vencido', 'activo'] })
      .getCount();

    const nuevoValor = activos > 0;
    if (nuevoValor === estudiante.carnetRetenido) return;
    estudiante.carnetRetenido = nuevoValor;
    await this.estudiantesRepo.save(estudiante);
  }

  async obtenerEstudiantes(): Promise<EstudianteEntidad[]> {
    await this.marcarVencidosEnLote();
    await this.sincronizarCarnetsRetenidosEnLote();
    return this.estudiantesRepo.find({ order: { id: 'ASC' } });
  }

  async obtenerDocentes(): Promise<DocenteEntidad[]> {
    return this.docentesRepo.find({ order: { id: 'ASC' } });
  }

  async obtenerPrestamos() {
    await this.marcarVencidosEnLote();
    await this.sincronizarCarnetsRetenidosEnLote();
    const prestamos = await this.prestamosRepo.find({
      relations: ['estudiante', 'docente', 'itemActivo'],
      order: { id: 'ASC' },
    });

    return prestamos.map((p: PrestamoEntidad) => this.mapPrestamoDto(p));
  }

  async crearPrestamo(datos: {
    carnetEstudiante: string;
    idDocente: number;
    idHerramienta: string;
    fechaPrestamo: string;
    fechaDevolucion: string;
    observaciones?: string;
  }) {
    const estudiante = await this.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');

    const docente = await this.docentesRepo.findOne({ where: { id: Number(datos.idDocente) } });
    if (!docente) throw new NotFoundException('Docente no encontrado.');

    const fechaPrestamo = new Date(datos.fechaPrestamo);
    const fechaDevolucion = new Date(datos.fechaDevolucion);
    if (Number.isNaN(fechaPrestamo.getTime()) || Number.isNaN(fechaDevolucion.getTime())) {
      throw new BadRequestException('Las fechas de préstamo/devolución no son válidas.');
    }
    if (fechaDevolucion.getTime() <= fechaPrestamo.getTime()) {
      throw new BadRequestException('La fecha de devolución debe ser posterior a la fecha de préstamo.');
    }

    const prestamo = this.prestamosRepo.create({
      estudiante,
      docente,
      codigoHerramienta: datos.idHerramienta,
      fechaPrestamo,
      fechaDevolucion,
      estado: this.estadoCalculado('pendiente', fechaDevolucion),
      observaciones: datos.observaciones?.trim() || '',
      itemActivo: null,
    });

    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    const completo = await this.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!completo) throw new NotFoundException('No se pudo recuperar el préstamo creado.');
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Prestamo',
      entidadId: completo.id,
      accion: 'crear',
      detalle: this.mapPrestamoDto(completo),
    });
    return this.mapPrestamoDto(completo);
  }

  async crearCanastaPrestamo(datos: {
    carnetEstudiante: string;
    idDocente: number;
    fechaPrestamo: string;
    fechaDevolucion: string;
    observaciones?: string;
    equipos: string[];
    consumibles: Array<{ idLote: number; cantidad: number; motivo: string }>;
  }) {
    const estudiante = await this.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');

    const docente = await this.docentesRepo.findOne({ where: { id: Number(datos.idDocente) } });
    if (!docente) throw new NotFoundException('Docente no encontrado.');

    const fechaPrestamo = new Date(datos.fechaPrestamo);
    const fechaDevolucion = new Date(datos.fechaDevolucion);
    if (Number.isNaN(fechaPrestamo.getTime()) || Number.isNaN(fechaDevolucion.getTime())) {
      throw new BadRequestException('Las fechas de la canasta no son válidas.');
    }
    if (fechaDevolucion.getTime() <= fechaPrestamo.getTime()) {
      throw new BadRequestException('La fecha de devolución debe ser posterior a la fecha de préstamo.');
    }

    const equipos = Array.from(new Set((datos.equipos ?? []).filter(Boolean)));
    const consumibles = datos.consumibles ?? [];
    if (equipos.length === 0 && consumibles.length === 0) {
      throw new BadRequestException('La canasta debe contener al menos un equipo o un consumible.');
    }

    const prestamosCreados: Array<ReturnType<PrestamoServicio['mapPrestamoDto']>> = [];
    for (const idHerramienta of equipos) {
      const prestamo = this.prestamosRepo.create({
        estudiante,
        docente,
        codigoHerramienta: idHerramienta,
        fechaPrestamo,
        fechaDevolucion,
        estado: this.estadoCalculado('pendiente', fechaDevolucion),
        observaciones: datos.observaciones?.trim() || 'Canasta de prestamo',
        itemActivo: null,
      });

      const guardado = await this.prestamosRepo.save(prestamo);
      const completo = await this.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
      if (completo) {
        prestamosCreados.push(this.mapPrestamoDto(completo));
      }
    }

    const salidasConsumibles: Array<{ idLote: number; lote: string; cantidad: number; motivo: string }> = [];
    for (const salida of consumibles) {
      const cantidad = Number(salida.cantidad ?? 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new BadRequestException(`Cantidad inválida para lote ${salida.idLote}.`);
      }

      const lote = await this.lotesRepo.findOne({ where: { id: Number(salida.idLote) }, relations: ['material'] });
      if (!lote) {
        throw new NotFoundException(`Lote no encontrado: ${salida.idLote}`);
      }
      if (lote.cantidadDisponible < cantidad) {
        throw new BadRequestException(`Stock insuficiente en lote ${lote.lote}. Disponible: ${lote.cantidadDisponible}`);
      }

      lote.cantidadDisponible -= cantidad;
      await this.lotesRepo.save(lote);

      const mov = this.movimientosMaterialRepo.create({
        lote,
        tipo: 'salida',
        cantidad,
        motivo: salida.motivo?.trim() || 'Salida por canasta de prestamo',
        referencia: `CANASTA-${estudiante.carnet}-${Date.now()}`,
      });
      await this.movimientosMaterialRepo.save(mov);

      salidasConsumibles.push({
        idLote: lote.id,
        lote: lote.lote,
        cantidad,
        motivo: mov.motivo,
      });
    }

    await this.sincronizarCarnetRetenidoEstudiante(estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();

    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'CanastaPrestamo',
      entidadId: `${estudiante.id}-${Date.now()}`,
      accion: 'crear',
      detalle: {
        estudiante: estudiante.carnet,
        docente: docente.codigo,
        equipos: prestamosCreados.map((p) => p.idHerramienta),
        consumibles: salidasConsumibles,
      },
    });

    return {
      ok: true,
      prestamos: prestamosCreados,
      consumibles: salidasConsumibles,
    };
  }

  async editarPrestamo(
    id: number,
    datos: Partial<{
      carnetEstudiante: string;
      idHerramienta: string;
      fechaPrestamo: string;
      fechaDevolucion: string | null;
      observaciones: string;
      idDocente: number;
      estado: 'pendiente' | 'devuelto' | 'vencido';
    }>,
  ) {
    const prestamo = await this.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    const snapshotAntes = this.mapPrestamoDto(prestamo);
    const idEstudianteAnterior = prestamo.estudiante.id;

    if (typeof datos.carnetEstudiante === 'string' && datos.carnetEstudiante.trim()) {
      const estudiante = await this.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante.trim() } });
      if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
      prestamo.estudiante = estudiante;
    }

    if (typeof datos.idHerramienta === 'string' && datos.idHerramienta.trim()) {
      prestamo.codigoHerramienta = datos.idHerramienta.trim();
    }

    if (typeof datos.idDocente === 'number') {
      const docente = await this.docentesRepo.findOne({ where: { id: Number(datos.idDocente) } });
      if (!docente) throw new NotFoundException('Docente no encontrado.');
      prestamo.docente = docente;
    }

    if (typeof datos.fechaPrestamo === 'string') {
      const fechaPrestamo = new Date(datos.fechaPrestamo);
      if (Number.isNaN(fechaPrestamo.getTime())) throw new BadRequestException('Fecha de préstamo inválida.');
      prestamo.fechaPrestamo = fechaPrestamo;
    }

    if (typeof datos.fechaDevolucion === 'string' || datos.fechaDevolucion === null) {
      const fechaDevolucion = datos.fechaDevolucion ? new Date(datos.fechaDevolucion) : null;
      if (datos.fechaDevolucion && Number.isNaN(fechaDevolucion!.getTime())) {
        throw new BadRequestException('Fecha de devolución inválida.');
      }
      prestamo.fechaDevolucion = fechaDevolucion;
    }

    if (typeof datos.observaciones === 'string') {
      prestamo.observaciones = datos.observaciones.trim();
    }

    if (prestamo.fechaDevolucion && prestamo.fechaDevolucion.getTime() <= prestamo.fechaPrestamo.getTime()) {
      throw new BadRequestException('La fecha de devolución debe ser posterior a la fecha de préstamo.');
    }

    prestamo.estado = this.estadoCalculado(datos.estado ?? prestamo.estado, prestamo.fechaDevolucion);
    if (datos.estado === 'devuelto') prestamo.estado = 'devuelto';

    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(idEstudianteAnterior);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Prestamo',
      entidadId: guardado.id,
      accion: 'actualizar',
      detalle: {
        antes: snapshotAntes,
        despues: this.mapPrestamoDto(guardado),
      },
    });
    return this.mapPrestamoDto(guardado);
  }

  async extenderFechaDevolucion(id: number, nuevaFechaDevolucion: string) {
    const prestamo = await this.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const nuevaFecha = new Date(nuevaFechaDevolucion);
    if (Number.isNaN(nuevaFecha.getTime())) throw new BadRequestException('Nueva fecha de devolución inválida.');
    if (nuevaFecha.getTime() <= prestamo.fechaPrestamo.getTime()) {
      throw new BadRequestException('La nueva fecha de devolución debe ser posterior a la fecha de préstamo.');
    }

    prestamo.fechaDevolucion = nuevaFecha;
    prestamo.estado = 'pendiente';
    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Prestamo',
      entidadId: guardado.id,
      accion: 'actualizar',
      detalle: {
        cambio: 'extender_fecha_devolucion',
        despues: this.mapPrestamoDto(guardado),
      },
    });
    return this.mapPrestamoDto(guardado);
  }

  async marcarDevuelto(id: number) {
    const prestamo = await this.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    prestamo.estado = 'devuelto';
    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Prestamo',
      entidadId: guardado.id,
      accion: 'actualizar',
      detalle: {
        cambio: 'marcar_devuelto',
        despues: this.mapPrestamoDto(guardado),
      },
    });
    return this.mapPrestamoDto(guardado);
  }

  async crearEstudiante(datos: {
    carnet: string;
    nombre: string;
    apellido: string;
    carrera: string;
    semestre: number;
    carnetRetenido?: boolean;
  }): Promise<EstudianteEntidad> {
    const carnet = datos.carnet.trim();
    const existente = await this.estudiantesRepo.findOne({ where: { carnet } });
    if (existente) {
      throw new BadRequestException('El carnet ya está registrado.');
    }

    const estudiante = this.estudiantesRepo.create({
      carnet,
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      carrera: datos.carrera.trim(),
      semestre: Number(datos.semestre),
      carnetRetenido: Boolean(datos.carnetRetenido),
    });
    const creado = await this.estudiantesRepo.save(estudiante);
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Estudiante',
      entidadId: creado.id,
      accion: 'crear',
      detalle: creado as unknown as Record<string, unknown>,
    });
    return creado;
  }

  async editarEstudiante(
    id: number,
    datos: Partial<{
      carnet: string;
      nombre: string;
      apellido: string;
      carrera: string;
      semestre: number;
      carnetRetenido: boolean;
    }>,
  ): Promise<EstudianteEntidad> {
    const estudiante = await this.estudiantesRepo.findOne({ where: { id } });
    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado.');
    }
    const snapshotAntes = { ...estudiante };

    if (datos.carnet && datos.carnet.trim() !== estudiante.carnet) {
      const existente = await this.estudiantesRepo.findOne({ where: { carnet: datos.carnet.trim() } });
      if (existente) {
        throw new BadRequestException('El carnet ya está registrado.');
      }
      estudiante.carnet = datos.carnet.trim();
    }

    if (typeof datos.nombre === 'string') estudiante.nombre = datos.nombre.trim();
    if (typeof datos.apellido === 'string') estudiante.apellido = datos.apellido.trim();
    if (typeof datos.carrera === 'string') estudiante.carrera = datos.carrera.trim();
    if (typeof datos.semestre === 'number') estudiante.semestre = Number(datos.semestre);
    if (typeof datos.carnetRetenido === 'boolean') estudiante.carnetRetenido = datos.carnetRetenido;

    const actualizado = await this.estudiantesRepo.save(estudiante);
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Estudiante',
      entidadId: actualizado.id,
      accion: 'actualizar',
      detalle: {
        antes: snapshotAntes,
        despues: actualizado,
      },
    });
    return actualizado;
  }

  async eliminarEstudiante(id: number): Promise<void> {
    const estudiante = await this.estudiantesRepo.findOne({ where: { id } });
    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado.');
    }
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Estudiante',
      entidadId: estudiante.id,
      accion: 'eliminar',
      detalle: estudiante as unknown as Record<string, unknown>,
    });
    await this.estudiantesRepo.remove(estudiante);
  }

  async crearDocente(datos: {
    codigo: string;
    nombre: string;
    apellido: string;
    materia: string;
    carnet: string;
  }): Promise<DocenteEntidad> {
    const codigo = datos.codigo.trim();
    const carnet = datos.carnet.trim();

    const existenteCodigo = await this.docentesRepo.findOne({ where: { codigo } });
    if (existenteCodigo) {
      throw new BadRequestException('El código de docente ya está registrado.');
    }

    const existenteCarnet = await this.docentesRepo.findOne({ where: { carnet } });
    if (existenteCarnet) {
      throw new BadRequestException('El carnet ya está registrado.');
    }

    const docente = this.docentesRepo.create({
      codigo,
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      materia: datos.materia.trim(),
      carnet,
    });
    const creado = await this.docentesRepo.save(docente);
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Docente',
      entidadId: creado.id,
      accion: 'crear',
      detalle: creado as unknown as Record<string, unknown>,
    });
    return creado;
  }

  async editarDocente(
    id: number,
    datos: Partial<{
      codigo: string;
      nombre: string;
      apellido: string;
      materia: string;
      carnet: string;
    }>,
  ): Promise<DocenteEntidad> {
    const docente = await this.docentesRepo.findOne({ where: { id } });
    if (!docente) {
      throw new NotFoundException('Docente no encontrado.');
    }
    const snapshotAntes = { ...docente };

    if (datos.codigo && datos.codigo.trim() !== docente.codigo) {
      const existente = await this.docentesRepo.findOne({ where: { codigo: datos.codigo.trim() } });
      if (existente) {
        throw new BadRequestException('El código de docente ya está registrado.');
      }
      docente.codigo = datos.codigo.trim();
    }

    if (datos.carnet && datos.carnet.trim() !== docente.carnet) {
      const existente = await this.docentesRepo.findOne({ where: { carnet: datos.carnet.trim() } });
      if (existente) {
        throw new BadRequestException('El carnet ya está registrado.');
      }
      docente.carnet = datos.carnet.trim();
    }

    if (typeof datos.nombre === 'string') docente.nombre = datos.nombre.trim();
    if (typeof datos.apellido === 'string') docente.apellido = datos.apellido.trim();
    if (typeof datos.materia === 'string') docente.materia = datos.materia.trim();

    const actualizado = await this.docentesRepo.save(docente);
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Docente',
      entidadId: actualizado.id,
      accion: 'actualizar',
      detalle: {
        antes: snapshotAntes,
        despues: actualizado,
      },
    });
    return actualizado;
  }

  async eliminarDocente(id: number): Promise<void> {
    const docente = await this.docentesRepo.findOne({ where: { id } });
    if (!docente) {
      throw new NotFoundException('Docente no encontrado.');
    }
    await this.auditoriaServicio.registrarEventoSilencioso({
      entidad: 'Docente',
      entidadId: docente.id,
      accion: 'eliminar',
      detalle: docente as unknown as Record<string, unknown>,
    });
    await this.docentesRepo.remove(docente);
  }
}
