import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { EstudianteEntidad } from './estudiante.entidad';
import { DocenteEntidad } from './docente.entidad';
import { ItemActivo } from '../activo/item_activo.entidad';
import { LoteMaterial } from '../material/lote_material.entidad';
import { MovimientoMaterial } from '../material/movimiento_material.entidad';

@Injectable()
export class PrestamoServicio {
  private readonly registrarEventoInterno = async (_input: unknown) => undefined;

  constructor(
    @InjectRepository(PrestamoEntidad)
    private readonly prestamosRepo: Repository<PrestamoEntidad>,
    @InjectRepository(EstudianteEntidad)
    private readonly estudiantesRepo: Repository<EstudianteEntidad>,
    @InjectRepository(DocenteEntidad)
    private readonly docentesRepo: Repository<DocenteEntidad>,
    @InjectRepository(ItemActivo)
    private readonly itemsActivosRepo: Repository<ItemActivo>,
    @InjectRepository(LoteMaterial)
    private readonly lotesRepo: Repository<LoteMaterial>,
    @InjectRepository(MovimientoMaterial)
    private readonly movimientosMaterialRepo: Repository<MovimientoMaterial>,
  ) {}

  private estadoCalculado(estadoActual: string, fechaDevolucion: Date | null | undefined): 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite' {
    if (estadoActual === 'devuelto') return 'devuelto';
    if (estadoActual === 'devuelto_fuera_de_fecha_limite') return 'devuelto_fuera_de_fecha_limite';
    if (estadoActual === 'activo') {
      if (!fechaDevolucion) return 'activo';
      return new Date(fechaDevolucion).getTime() < Date.now() ? 'vencido' : 'activo';
    }
    if (!fechaDevolucion) return 'pendiente';
    return new Date(fechaDevolucion).getTime() < Date.now() ? 'vencido' : 'pendiente';
  }

  private estadoDevolucionFinal(fechaLimite: Date | null | undefined): 'devuelto' | 'devuelto_fuera_de_fecha_limite' {
    if (!fechaLimite) return 'devuelto';
    return Date.now() > new Date(fechaLimite).getTime()
      ? 'devuelto_fuera_de_fecha_limite'
      : 'devuelto';
  }

  private parsearIdItem(idHerramienta: string): number {
    const idItem = Number(idHerramienta);
    if (!Number.isInteger(idItem) || idItem <= 0) {
      throw new BadRequestException('El identificador del item de activo no es válido.');
    }
    return idItem;
  }

  private async obtenerItemActivo(idHerramienta: string): Promise<ItemActivo> {
    const idItem = this.parsearIdItem(idHerramienta);
    const item = await this.itemsActivosRepo.findOne({ where: { id: idItem }, relations: ['activo'] });
    if (!item) throw new NotFoundException('Item de activo no encontrado.');
    return item;
  }

  private async validarDisponibilidadItem(idHerramienta: string, excluirPrestamoId?: number) {
    const qb = this.prestamosRepo
      .createQueryBuilder('p')
      .where('p.codigo_herramienta = :idHerramienta', { idHerramienta })
      .andWhere('p.estado NOT IN (:...estadosCerrados)', { estadosCerrados: ['devuelto', 'devuelto_fuera_de_fecha_limite'] })
      .andWhere('p.deleted_at IS NULL');

    if (typeof excluirPrestamoId === 'number') {
      qb.andWhere('p.id <> :excluirPrestamoId', { excluirPrestamoId });
    }

    const enUso = await qb.getCount();
    if (enUso > 0) {
      throw new BadRequestException('El item seleccionado ya tiene un préstamo activo y no puede volver a prestarse hasta su devolución.');
    }
  }

  private mapPrestamoDto(p: PrestamoEntidad) {
    return {
      id: p.id,
      carnetEstudiante: p.estudiante?.carnet,
      idHerramienta: p.codigoHerramienta,
      grupoCanasta: p.grupoCanasta ?? null,
      idDocente: p.docente?.id,
      fechaPrestamo: p.fechaPrestamo,
      fechaDevolucion: p.fechaDevolucion,
      estado: p.estado,
      docente: p.docente ? `${p.docente.nombre} ${p.docente.apellido}` : '',
      observaciones: p.observaciones ?? '',
    };
  }

  private mapCanastaDto(
    prestamos: PrestamoEntidad[],
    consumibles: Array<{
      idLote: number;
      lote: string;
      material: string;
      cantidad: number;
      motivo: string;
      fecha: Date;
    }> = [],
  ) {
    const primero = prestamos[0];
    const idCanasta = primero.grupoCanasta ?? `IND-${primero.id}`;
    const estados = prestamos.map((p) => p.estado);

    const estadoCanasta: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite' = estados.includes('vencido')
      ? 'vencido'
      : estados.includes('activo')
        ? 'activo'
        : estados.includes('pendiente')
          ? 'pendiente'
          : estados.includes('devuelto_fuera_de_fecha_limite')
            ? 'devuelto_fuera_de_fecha_limite'
            : 'devuelto';

    return {
      id: idCanasta,
      grupoCanasta: primero.grupoCanasta ?? null,
      idsPrestamo: prestamos.map((p) => p.id),
      carnetEstudiante: primero.estudiante?.carnet ?? '',
      idDocente: primero.docente?.id,
      docente: primero.docente ? `${primero.docente.nombre} ${primero.docente.apellido}` : '',
      fechaPrestamo: primero.fechaPrestamo,
      fechaDevolucion: primero.fechaDevolucion,
      estado: estadoCanasta,
      observaciones: primero.observaciones ?? '',
      cosas: prestamos.map((p) => ({
        idHerramienta: p.codigoHerramienta,
        codigoInventario: p.itemActivo?.codigoInventario ?? p.codigoHerramienta,
        nombre: p.itemActivo?.activo?.nombre ?? 'Activo',
      })),
      consumibles,
      totalActivos: prestamos.length,
      totalConsumibles: consumibles.reduce((acc, c) => acc + c.cantidad, 0),
      totalCosas: prestamos.length + consumibles.reduce((acc, c) => acc + c.cantidad, 0),
    };
  }

  private async obtenerConsumiblesPorReferencias(
    referencias: string[],
  ): Promise<
    Map<
      string,
      Array<{
        idLote: number;
        lote: string;
        material: string;
        cantidad: number;
        motivo: string;
        fecha: Date;
      }>
    >
  > {
    const mapa = new Map<
      string,
      Array<{
        idLote: number;
        lote: string;
        material: string;
        cantidad: number;
        motivo: string;
        fecha: Date;
      }>
    >();

    const limpias = Array.from(new Set((referencias ?? []).map((r) => r?.trim()).filter(Boolean) as string[]));
    if (limpias.length === 0) return mapa;

    const movimientos = await this.movimientosMaterialRepo.find({
      where: limpias.map((ref) => ({ referencia: ref, tipo: 'salida' as const })),
      relations: ['lote', 'lote.material'],
      order: { fecha: 'ASC', id: 'ASC' },
    });

    for (const mov of movimientos) {
      const ref = (mov.referencia ?? '').trim();
      if (!ref) continue;

      const lista = mapa.get(ref) ?? [];
      lista.push({
        idLote: mov.lote?.id ?? 0,
        lote: mov.lote?.lote ?? '',
        material: mov.lote?.material?.nombre ?? 'Material',
        cantidad: Number(mov.cantidad ?? 0),
        motivo: mov.motivo ?? '',
        fecha: mov.fecha,
      });
      mapa.set(ref, lista);
    }

    return mapa;
  }

  private async resolverPrestamosPorCanastaId(canastaId: string): Promise<PrestamoEntidad[]> {
    if (!canastaId?.trim()) {
      throw new BadRequestException('Identificador de canasta no válido.');
    }

    const limpio = canastaId.trim();
    if (limpio.startsWith('IND-')) {
      const id = Number(limpio.replace('IND-', ''));
      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequestException('Identificador de canasta individual no válido.');
      }

      const unico = await this.prestamosRepo.findOne({
        where: { id },
        relations: ['estudiante', 'docente', 'itemActivo', 'itemActivo.activo'],
      });
      if (!unico || unico.deletedAt) {
        throw new NotFoundException('Canasta no encontrada.');
      }
      return [unico];
    }

    const items = await this.prestamosRepo.find({
      where: { grupoCanasta: limpio },
      relations: ['estudiante', 'docente', 'itemActivo', 'itemActivo.activo'],
      order: { id: 'ASC' },
    });

    const vigentes = items.filter((p) => !p.deletedAt);
    if (vigentes.length === 0) {
      throw new NotFoundException('Canasta no encontrada.');
    }

    return vigentes;
  }

  async obtenerCanastasPrestamo() {
    await this.marcarVencidosEnLote();
    await this.sincronizarCarnetsRetenidosEnLote();

    const prestamos = await this.prestamosRepo.find({
      relations: ['estudiante', 'docente', 'itemActivo', 'itemActivo.activo'],
      order: { id: 'ASC' },
    });

    const vigentes = prestamos.filter((p) => !p.deletedAt);
    const grupos = new Map<string, PrestamoEntidad[]>();

    for (const p of vigentes) {
      const clave = p.grupoCanasta ?? `IND-${p.id}`;
      const lista = grupos.get(clave) ?? [];
      lista.push(p);
      grupos.set(clave, lista);
    }

    const referencias = Array.from(grupos.keys()).filter((k) => !k.startsWith('IND-'));
    const consumiblesPorCanasta = await this.obtenerConsumiblesPorReferencias(referencias);

    return Array.from(grupos.entries()).map(([clave, lista]) =>
      this.mapCanastaDto(lista, consumiblesPorCanasta.get(clave) ?? []),
    );
  }

  async editarCanastaPrestamo(
    canastaId: string,
    datos: Partial<{
      carnetEstudiante: string;
      fechaPrestamo: string;
      fechaDevolucion: string | null;
      observaciones: string;
      idDocente: number;
      estado: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite';
    }>,
  ) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const estudianteAnterior = prestamos[0].estudiante.id;

    let estudianteDestino = prestamos[0].estudiante;
    if (typeof datos.carnetEstudiante === 'string' && datos.carnetEstudiante.trim()) {
      const encontrado = await this.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante.trim() } });
      if (!encontrado) throw new NotFoundException('Estudiante no encontrado.');
      estudianteDestino = encontrado;
    }

    let docenteDestino = prestamos[0].docente;
    if (typeof datos.idDocente === 'number') {
      const encontrado = await this.docentesRepo.findOne({ where: { id: Number(datos.idDocente) } });
      if (!encontrado) throw new NotFoundException('Docente no encontrado.');
      docenteDestino = encontrado;
    }

    const fechaPrestamoDestino = datos.fechaPrestamo ? new Date(datos.fechaPrestamo) : prestamos[0].fechaPrestamo;
    const fechaDevolucionDestino = datos.fechaDevolucion !== undefined
      ? (datos.fechaDevolucion ? new Date(datos.fechaDevolucion) : null)
      : prestamos[0].fechaDevolucion;

    if (Number.isNaN(fechaPrestamoDestino.getTime())) {
      throw new BadRequestException('Fecha de préstamo inválida.');
    }
    if (fechaDevolucionDestino && Number.isNaN(fechaDevolucionDestino.getTime())) {
      throw new BadRequestException('Fecha de devolución inválida.');
    }
    if (fechaDevolucionDestino && fechaDevolucionDestino.getTime() <= fechaPrestamoDestino.getTime()) {
      throw new BadRequestException('La fecha de devolución debe ser posterior a la fecha de préstamo.');
    }

    for (const p of prestamos) {
      p.estudiante = estudianteDestino;
      p.docente = docenteDestino;
      p.fechaPrestamo = fechaPrestamoDestino;
      p.fechaDevolucion = fechaDevolucionDestino;

      if (typeof datos.observaciones === 'string') {
        p.observaciones = datos.observaciones.trim();
      }

      p.estado = this.estadoCalculado(datos.estado ?? p.estado, p.fechaDevolucion);
      if (datos.estado === 'devuelto') {
        p.estado = this.estadoDevolucionFinal(p.fechaDevolucion);
      }

      await this.prestamosRepo.save(p);
    }

    await this.sincronizarCarnetRetenidoEstudiante(estudianteAnterior);
    await this.sincronizarCarnetRetenidoEstudiante(estudianteDestino.id);
    await this.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const consumiblesPorCanasta = await this.obtenerConsumiblesPorReferencias([canastaId]);
    return this.mapCanastaDto(recargados, consumiblesPorCanasta.get(canastaId) ?? []);
  }

  async extenderCanastaPrestamo(canastaId: string, fechaDevolucion: string) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const nuevaFecha = new Date(fechaDevolucion);
    if (Number.isNaN(nuevaFecha.getTime())) throw new BadRequestException('Nueva fecha de devolución inválida.');

    for (const p of prestamos) {
      if (nuevaFecha.getTime() <= p.fechaPrestamo.getTime()) {
        throw new BadRequestException('La nueva fecha de devolución debe ser posterior a la fecha de préstamo.');
      }
      p.fechaDevolucion = nuevaFecha;
      p.estado = this.estadoCalculado('activo', nuevaFecha);
      await this.prestamosRepo.save(p);
    }

    await this.sincronizarCarnetRetenidoEstudiante(prestamos[0].estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const consumiblesPorCanasta = await this.obtenerConsumiblesPorReferencias([canastaId]);
    return this.mapCanastaDto(recargados, consumiblesPorCanasta.get(canastaId) ?? []);
  }

  async devolverCanastaPrestamo(canastaId: string) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);

    for (const p of prestamos) {
      p.estado = this.estadoDevolucionFinal(p.fechaDevolucion);
      await this.prestamosRepo.save(p);
    }

    await this.sincronizarCarnetRetenidoEstudiante(prestamos[0].estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const consumiblesPorCanasta = await this.obtenerConsumiblesPorReferencias([canastaId]);
    return this.mapCanastaDto(recargados, consumiblesPorCanasta.get(canastaId) ?? []);
  }

  async eliminarCanastaPrestamo(canastaId: string): Promise<void> {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const idEstudiante = prestamos[0].estudiante.id;
    await this.prestamosRepo.softRemove(prestamos);
    await this.sincronizarCarnetRetenidoEstudiante(idEstudiante);
    await this.sincronizarCarnetsRetenidosEnLote();
  }

  private async marcarVencidosEnLote() {
    await this.prestamosRepo
      .createQueryBuilder()
      .update(PrestamoEntidad)
      .set({ estado: 'vencido' })
      .where('estado IN (:...estados)', { estados: ['pendiente', 'activo'] })
      .andWhere('deleted_at IS NULL')
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
            AND p.deleted_at IS NULL
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
            AND p.deleted_at IS NULL
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
      .andWhere('p.deleted_at IS NULL')
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

    const idHerramienta = datos.idHerramienta.trim();
    if (!idHerramienta) {
      throw new BadRequestException('Debes seleccionar un item de activo válido.');
    }

    const itemActivo = await this.obtenerItemActivo(idHerramienta);
    await this.validarDisponibilidadItem(idHerramienta);

    const prestamo = this.prestamosRepo.create({
      estudiante,
      docente,
      codigoHerramienta: idHerramienta,
      fechaPrestamo,
      fechaDevolucion,
      estado: this.estadoCalculado('activo', fechaDevolucion),
      observaciones: datos.observaciones?.trim() || '',
      itemActivo,
    });

    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    const completo = await this.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!completo) throw new NotFoundException('No se pudo recuperar el préstamo creado.');
    await this.registrarEventoInterno({
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
      throw new BadRequestException('La canasta debe contener al menos un activo fijo o un material fungible.');
    }

    const prestamosCreados: Array<ReturnType<PrestamoServicio['mapPrestamoDto']>> = [];
    const grupoCanasta = `CANASTA-${estudiante.carnet}-${Date.now()}`;
    for (const idHerramienta of equipos) {
      const idHerramientaLimpio = idHerramienta.trim();
      if (!idHerramientaLimpio) continue;

      const itemActivo = await this.obtenerItemActivo(idHerramientaLimpio);
      await this.validarDisponibilidadItem(idHerramientaLimpio);

      const prestamo = this.prestamosRepo.create({
        estudiante,
        docente,
        codigoHerramienta: idHerramientaLimpio,
        grupoCanasta,
        fechaPrestamo,
        fechaDevolucion,
        estado: this.estadoCalculado('activo', fechaDevolucion),
        observaciones: datos.observaciones?.trim() || 'Canasta de prestamo',
        itemActivo,
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
        referencia: grupoCanasta,
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

    await this.registrarEventoInterno({
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
      estado: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite';
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
      const nuevoIdHerramienta = datos.idHerramienta.trim();
      await this.obtenerItemActivo(nuevoIdHerramienta);
      await this.validarDisponibilidadItem(nuevoIdHerramienta, prestamo.id);
      prestamo.codigoHerramienta = nuevoIdHerramienta;
      prestamo.itemActivo = await this.obtenerItemActivo(nuevoIdHerramienta);
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
    if (datos.estado === 'devuelto') {
      prestamo.estado = this.estadoDevolucionFinal(prestamo.fechaDevolucion);
    }

    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(idEstudianteAnterior);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.registrarEventoInterno({
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
    prestamo.estado = this.estadoCalculado('activo', nuevaFecha);
    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.registrarEventoInterno({
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

    prestamo.estado = this.estadoDevolucionFinal(prestamo.fechaDevolucion);
    const guardado = await this.prestamosRepo.save(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
    await this.registrarEventoInterno({
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
    await this.registrarEventoInterno({
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
    await this.registrarEventoInterno({
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
    await this.registrarEventoInterno({
      entidad: 'Estudiante',
      entidadId: estudiante.id,
      accion: 'eliminar',
      detalle: estudiante as unknown as Record<string, unknown>,
    });
    await this.estudiantesRepo.softRemove(estudiante);
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
    await this.registrarEventoInterno({
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
    await this.registrarEventoInterno({
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
    await this.registrarEventoInterno({
      entidad: 'Docente',
      entidadId: docente.id,
      accion: 'eliminar',
      detalle: docente as unknown as Record<string, unknown>,
    });
    await this.docentesRepo.softRemove(docente);
  }

  async eliminarPrestamo(id: number): Promise<void> {
    const prestamo = await this.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado.');
    }

    await this.registrarEventoInterno({
      entidad: 'Prestamo',
      entidadId: prestamo.id,
      accion: 'eliminar',
      detalle: this.mapPrestamoDto(prestamo),
    });

    await this.prestamosRepo.softRemove(prestamo);
    await this.sincronizarCarnetRetenidoEstudiante(prestamo.estudiante.id);
    await this.sincronizarCarnetsRetenidosEnLote();
  }
}
