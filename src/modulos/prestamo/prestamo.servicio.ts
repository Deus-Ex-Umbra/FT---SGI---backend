import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Brackets, In } from 'typeorm';
import { PrestamoEntidad } from './entidades/prestamo.entidad';
import { HistorialPrestamoEntidad } from './entidades/historial-prestamo.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { GrupoMateriaDocenteEntidad } from '@/modulos/docencia/entidades/grupo-materia-docente.entidad';
import { SubgrupoPrestamoDocenciaEntidad } from '@/modulos/docencia/entidades/subgrupo-prestamo-docencia.entidad';
import { MateriaEntidad } from './entidades/materia.entidad';
import { CarreraServicio } from './carrera.servicio';
import { MateriaServicio } from './materia.servicio';
import { PrestamoCanastaServicio } from './prestamo-canasta.servicio';
import { PrestamoUtilServicio } from './prestamo-util.servicio';

@Injectable()
export class PrestamoServicio {
  constructor(
    private readonly carreraServicio: CarreraServicio,
    private readonly materiaServicio: MateriaServicio,
    private readonly prestamoCanastaServicio: PrestamoCanastaServicio,
    private readonly util: PrestamoUtilServicio,
    @InjectRepository(GrupoMateriaDocenteEntidad)
    private readonly gruposMateriaDocenciaRepo: Repository<GrupoMateriaDocenteEntidad>,
    @InjectRepository(SubgrupoPrestamoDocenciaEntidad)
    private readonly subgruposPrestamoRepo: Repository<SubgrupoPrestamoDocenciaEntidad>,
    @InjectRepository(MateriaEntidad)
    private readonly materiasRepo: Repository<MateriaEntidad>,
  ) {}

  private mapPrestamoDto(p: PrestamoEntidad) {
    const nombreDocente = this.util.obtenerNombreCompletoDocente(p.docente);
    return {
      id: p.id,
      carnetEstudiante: p.estudiante?.carnet,
      idHerramienta: p.codigoHerramienta,
      grupoCanasta: p.grupoCanasta ?? null,
      codigo: p.codigo ?? null,
      idDocente: p.docente?.id,
      fechaPrestamo: p.fechaPrestamo,
      fechaDevolucion: p.fechaDevolucion,
      estado: p.estado,
      docente: nombreDocente,
      observaciones: p.observaciones ?? '',
    };
  }
  async obtenerPrestamos(ejecutor?: any) {
    await this.util.marcarVencidosEnLote();
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const queryBuilder = this.util.prestamosRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.estudiante', 'estudiante')
      .leftJoinAndSelect('estudiante.usuario', 'estudianteUsuario')
      .leftJoinAndSelect('p.docente', 'docente')
      .leftJoinAndSelect('p.itemActivo', 'itemActivo')
      .leftJoinAndSelect('itemActivo.activo', 'activo')
      .leftJoinAndSelect('activo.inventario', 'inventario')
      .leftJoinAndSelect('p.inventario', 'inventarioPrestamo')
      .orderBy('p.fecha_prestamo', 'DESC')
      .addOrderBy('p.id', 'DESC');

    if (ejecutor) {
      if (ejecutor.rol === 'docente') {
        queryBuilder.andWhere('docente.id = :ejecutorId', { ejecutorId: ejecutor.id });
      } else if (ejecutor.rol === 'estudiante') {
        const estudiante = await this.util.estudiantesRepo.findOne({ where: { usuario: { id: ejecutor.id } } });
        if (estudiante) {
          const participaciones = await this.util.canastaEstudiantesRepo.find({ where: { estudiante: { id: estudiante.id } } });
          const gruposCanasta = Array.from(new Set(participaciones.map(p => p.grupoCanasta).filter(Boolean)));
          if (gruposCanasta.length > 0) {
            queryBuilder.andWhere('(p.id_estudiante = :estudianteId OR p.grupo_canasta IN (:...gruposCanasta))', {
              estudianteId: estudiante.id,
              gruposCanasta,
            });
          } else {
            queryBuilder.andWhere('p.id_estudiante = :estudianteId', { estudianteId: estudiante.id });
          }
        } else {
          queryBuilder.andWhere('p.id = -1');
        }
      } else if (ejecutor.rol === 'encargado_inventario') {
        const encargado = await this.util.encargadosRepo.findOne({
          where: { usuario: { id: ejecutor.id } },
          relations: ['inventario'],
        });
        if (encargado?.inventario) {
          const idInventario = encargado.inventario.id;
          const fungiblesInventario = await this.util.itemsFungiblesRepo.find({
            where: { activo: { inventario: { id: idInventario } } },
            select: ['id'],
          });
          const idsFungibles = fungiblesInventario.map(f => f.id);

          queryBuilder.andWhere(new Brackets(qb => {
            qb.where('inventarioPrestamo.id = :idInventario', { idInventario })
              .orWhere('inventario.id = :idInventario', { idInventario });
            if (idsFungibles.length > 0) {
              qb.orWhere(`EXISTS (
                SELECT 1 
                FROM jsonb_to_recordset(COALESCE(p.consumibles, '[]'::jsonb)) as x("idLote" text) 
                WHERE x."idLote" IN (:...idsFungibles)
              )`, { idsFungibles });
            }
          }));
        } else {
          queryBuilder.andWhere('p.id = -1');
        }
      }
    }

    const prestamos = await queryBuilder.getMany();
    return prestamos.map((p) => this.mapPrestamoDto(p));
  }


  async crearPrestamo(datos: {
    carnetEstudiante: string;
    idDocente: number;
    idHerramienta: string;
    fechaPrestamo: string;
    fechaDevolucion: string;
    observaciones?: string;
    carnetRetenido?: boolean;
  }, ejecutor?: any) {
    const estudiante = await this.util.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carnetRetenido) {
      throw new BadRequestException(`El estudiante ${estudiante.nombre} ${estudiante.apellido} (${estudiante.carnet}) tiene su carnet retenido.`);
    }

    const docente = await this.util.obtenerDocenteUsuarioPorId(Number(datos.idDocente));
    const fechaPrestamo = new Date(datos.fechaPrestamo);
    const fechaDevolucion = new Date(datos.fechaDevolucion);
    if (Number.isNaN(fechaPrestamo.getTime()) || Number.isNaN(fechaDevolucion.getTime())) {
      throw new BadRequestException('Fechas no válidas.');
    }
    if (fechaDevolucion.getTime() <= fechaPrestamo.getTime()) {
      throw new BadRequestException('Fecha de devolución debe ser posterior.');
    }

    const idHerramienta = datos.idHerramienta.trim();
    if (!idHerramienta) throw new BadRequestException('Debes seleccionar un item.');

    const itemActivo = await this.util.obtenerItemActivo(idHerramienta);
    const estadoInicial = ejecutor?.rol === 'docente' ? 'solicitado' : 'despachado';
    if (estadoInicial === 'despachado') {
      await this.util.validarDisponibilidadItem(idHerramienta, undefined, itemActivo);
    }

    const codigo = this.util.generarCodigoPrestamo(fechaPrestamo, estudiante.carnet, idHerramienta);
    const prestamo = this.util.prestamosRepo.create({
      estudiante,
      docente,
      codigoHerramienta: idHerramienta,
      fechaPrestamo,
      fechaDevolucion,
      estado: estadoInicial,
      observaciones: datos.observaciones?.trim() || '',
      itemActivo,
      codigo,
      carnetRetenido: datos.carnetRetenido !== undefined ? datos.carnetRetenido : (estadoInicial === 'despachado'),
      inventario: itemActivo?.activo?.inventario ?? { id: 1 } as any,
    });

    const guardado = await this.util.prestamosRepo.save(prestamo);
    if (estadoInicial === 'despachado') {
      await this.util.marcarItemEnPrestamo(itemActivo);
    }

    await this.util.sincronizarCarnetRetenidoEstudiante(estudiante.id);
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const completo = await this.util.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!completo) throw new NotFoundException('No se pudo recuperar el préstamo.');

    await this.util.registrarCambioHistorial(completo, 'creacion_solicitud', completo.estado, estadoInicial === 'solicitado' ? 'Préstamo solicitado.' : 'Préstamo creado.', ejecutor);
    return this.mapPrestamoDto(completo);
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
      carnetRetenido: boolean;
    }>,
    ejecutor?: any,
  ) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    const idEstudianteAnterior = prestamo.estudiante.id;

    const antes: Record<string, any> = {};
    const despues: Record<string, any> = {};

    if (typeof datos.carnetEstudiante === 'string' && datos.carnetEstudiante.trim()) {
      const estudiante = await this.util.estudiantesRepo.findOne({ where: { carnet: datos.carnetEstudiante.trim() } });
      if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
      if (prestamo.estudiante.id !== estudiante.id) {
        antes.carnetEstudiante = prestamo.estudiante.carnet;
        despues.carnetEstudiante = estudiante.carnet;
      }
      prestamo.estudiante = estudiante;
    }

    if (typeof datos.idHerramienta === 'string' && datos.idHerramienta.trim()) {
      const nuevoIdH = datos.idHerramienta.trim();
      await this.util.obtenerItemActivo(nuevoIdH);
      await this.util.validarDisponibilidadItem(nuevoIdH, prestamo.id);
      if (prestamo.codigoHerramienta !== nuevoIdH) {
        antes.idHerramienta = prestamo.codigoHerramienta;
        despues.idHerramienta = nuevoIdH;
      }
      prestamo.codigoHerramienta = nuevoIdH;
      prestamo.itemActivo = await this.util.obtenerItemActivo(nuevoIdH);
      prestamo.inventario = prestamo.itemActivo?.activo?.inventario ?? { id: 1 } as any;
    }

    if (typeof datos.idDocente === 'number') {
      const nuevoDocente = await this.util.obtenerDocenteUsuarioPorId(Number(datos.idDocente));
      if (prestamo.docente.id !== nuevoDocente.id) {
        antes.idDocente = prestamo.docente.id;
        despues.idDocente = nuevoDocente.id;
      }
      prestamo.docente = nuevoDocente;
    }

    if (typeof datos.fechaPrestamo === 'string') {
      const fechaP = new Date(datos.fechaPrestamo);
      if (Number.isNaN(fechaP.getTime())) throw new BadRequestException('Fecha inválida.');
      if (prestamo.fechaPrestamo.getTime() !== fechaP.getTime()) {
        antes.fechaPrestamo = prestamo.fechaPrestamo.toISOString();
        despues.fechaPrestamo = fechaP.toISOString();
      }
      prestamo.fechaPrestamo = fechaP;
    }

    if (typeof datos.fechaDevolucion === 'string' || datos.fechaDevolucion === null) {
      const fechaD = datos.fechaDevolucion ? new Date(datos.fechaDevolucion) : null;
      if (datos.fechaDevolucion && Number.isNaN(fechaD!.getTime())) throw new BadRequestException('Fecha inválida.');
      const valAnt = prestamo.fechaDevolucion ? prestamo.fechaDevolucion.getTime() : null;
      const valNue = fechaD ? fechaD.getTime() : null;
      if (valAnt !== valNue) {
        antes.fechaDevolucion = prestamo.fechaDevolucion ? prestamo.fechaDevolucion.toISOString() : null;
        despues.fechaDevolucion = fechaD ? fechaD.toISOString() : null;
      }
      prestamo.fechaDevolucion = fechaD;
    }

    if (typeof datos.observaciones === 'string') {
      const obs = datos.observaciones.trim();
      if ((prestamo.observaciones ?? '') !== obs) {
        antes.observaciones = prestamo.observaciones ?? '';
        despues.observaciones = obs;
      }
      prestamo.observaciones = obs;
    }

    if (typeof datos.carnetRetenido === 'boolean') {
      if (prestamo.carnetRetenido !== datos.carnetRetenido) {
        antes.carnetRetenido = prestamo.carnetRetenido;
        despues.carnetRetenido = datos.carnetRetenido;
      }
      prestamo.carnetRetenido = datos.carnetRetenido;
    }

    if (prestamo.fechaDevolucion && prestamo.fechaDevolucion.getTime() <= prestamo.fechaPrestamo.getTime()) {
      throw new BadRequestException('Fecha de devolución debe ser posterior.');
    }

    const estadoAnterior = prestamo.estado;
    let estadoFinal = this.util.estadoCalculado(datos.estado ?? prestamo.estado, prestamo.fechaDevolucion);
    if (datos.estado === 'devuelto') {
      estadoFinal = this.util.estadoDevolucionFinal(prestamo.fechaDevolucion);
    }
    if (estadoAnterior !== estadoFinal) {
      antes.estado = estadoAnterior;
      despues.estado = estadoFinal;
    }
    prestamo.estado = estadoFinal;

    const guardado = await this.util.prestamosRepo.save(prestamo);
    if (guardado.itemActivo && (guardado.estado === 'devuelto' || guardado.estado === 'devuelto_fuera_de_fecha_limite')) {
      await this.util.marcarItemDisponibleAlDevolver(guardado.itemActivo);
    }

    await this.util.sincronizarCarnetRetenidoEstudiante(idEstudianteAnterior);
    await this.util.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.util.sincronizarCarnetsRetenidosEnLote();

    if (Object.keys(despues).length > 0) {
      const accion = antes.estado !== despues.estado && (despues.estado === 'devuelto' || despues.estado === 'devuelto_fuera_de_fecha_limite')
        ? 'devolucion'
        : (antes.estado !== despues.estado ? 'modificacion_estado' : 'modificacion_detalles');
      await this.util.registrarCambioHistorial(guardado, accion, guardado.estado, 'Préstamo editado.', ejecutor, { antes, despues });
    }

    return this.mapPrestamoDto(guardado);
  }

  async extenderFechaDevolucion(id: number, nuevaFechaDevolucion: string, ejecutor?: any) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const nuevaFecha = new Date(nuevaFechaDevolucion);
    if (Number.isNaN(nuevaFecha.getTime())) throw new BadRequestException('Nueva fecha inválida.');
    if (nuevaFecha.getTime() <= prestamo.fechaPrestamo.getTime()) throw new BadRequestException('Fecha debe ser posterior.');

    const estadoAnterior = prestamo.estado;
    const fechaAnterior = prestamo.fechaDevolucion;
    prestamo.fechaDevolucion = nuevaFecha;
    prestamo.estado = this.util.estadoCalculado('activo', nuevaFecha);
    const guardado = await this.util.prestamosRepo.save(prestamo);

    await this.util.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.util.sincronizarCarnetsRetenidosEnLote();

    await this.util.registrarCambioHistorial(guardado, 'extension', guardado.estado, `Fecha extendida a ${nuevaFecha.toISOString().slice(0, 10)}.`, ejecutor, {
      antes: { fechaDevolucion: fechaAnterior ? fechaAnterior.toISOString() : null, estado: estadoAnterior },
      despues: { fechaDevolucion: guardado.fechaDevolucion ? guardado.fechaDevolucion.toISOString() : null, estado: guardado.estado }
    });

    return this.mapPrestamoDto(guardado);
  }

  async marcarDevuelto(id: number, ejecutor?: any) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const estadoAnterior = prestamo.estado;
    prestamo.estado = this.util.estadoDevolucionFinal(prestamo.fechaDevolucion);
    prestamo.fechaDevolucion = new Date(); // Update return date to actual return time!
    const guardado = await this.util.prestamosRepo.save(prestamo);

    if (guardado.itemActivo) {
      await this.util.marcarItemDisponibleAlDevolver(guardado.itemActivo);
    } else if (guardado.codigoHerramienta) {
      try {
        const item = await this.util.obtenerItemActivo(guardado.codigoHerramienta);
        await this.util.marcarItemDisponibleAlDevolver(item);
      } catch {}
    }

    await this.util.sincronizarCarnetRetenidoEstudiante(guardado.estudiante.id);
    await this.util.sincronizarCarnetsRetenidosEnLote();

    await this.util.registrarCambioHistorial(guardado, 'devolucion', guardado.estado, 'Préstamo devuelto.', ejecutor, {
      antes: { estado: estadoAnterior },
      despues: { estado: guardado.estado }
    });

    return this.mapPrestamoDto(guardado);
  }

  async devolverPrestamoCompleto(
    id: number,
    datos: { estadoFisicoDevolucion?: string; carnetDevuelto?: boolean; observaciones?: string },
    ejecutor?: any,
  ) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const estadoAnterior = prestamo.estado;
    prestamo.estado = this.util.estadoDevolucionFinal(prestamo.fechaDevolucion);
    prestamo.estadoFisicoDevolucion = datos.estadoFisicoDevolucion || 'bueno';

    if (datos.observaciones?.trim()) {
      prestamo.observaciones = `${prestamo.observaciones || ''}\nDevolución: ${datos.observaciones.trim()}`.trim();
    }

    const carnetDevuelto = typeof datos.carnetDevuelto === 'boolean' ? datos.carnetDevuelto : true;
    if (carnetDevuelto) prestamo.carnetRetenido = false;

    prestamo.fechaDevolucion = new Date(); // Update return date to actual return time!

    const guardado = await this.util.prestamosRepo.save(prestamo);
    if (guardado.itemActivo) {
      await this.util.marcarItemDisponibleAlDevolver(guardado.itemActivo);
      guardado.itemActivo.estado_fisico = prestamo.estadoFisicoDevolucion || 'bueno';
      await this.util.itemsActivosRepo.save(guardado.itemActivo);
    }

    if (carnetDevuelto) {
      guardado.estudiante.carnetRetenido = false;
      await this.util.estudiantesRepo.save(guardado.estudiante);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();

    await this.util.registrarCambioHistorial(guardado, 'devolucion', guardado.estado, 'Préstamo devuelto.', ejecutor, {
      antes: { estado: estadoAnterior },
      despues: { estado: guardado.estado, estadoFisicoDevolucion: guardado.estadoFisicoDevolucion }
    });

    return this.mapPrestamoDto(guardado);
  }

  async eliminarPrestamo(id: number, ejecutor?: any): Promise<void> {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    await this.util.registrarCambioHistorial(prestamo, 'eliminacion', prestamo.estado, 'Préstamo eliminado (soft delete).', ejecutor, {
      antes: { deletedAt: null },
      despues: { deletedAt: new Date().toISOString() }
    });

    await this.util.prestamosRepo.softRemove(prestamo);
    await this.util.sincronizarCarnetRetenidoEstudiante(prestamo.estudiante.id);
    await this.util.sincronizarCarnetsRetenidosEnLote();
  }

  async aceptarPrestamo(id: number, ejecutor?: any) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado !== 'solicitado') throw new BadRequestException('El préstamo no está solicitado.');

    const estadoAnterior = prestamo.estado;
    prestamo.estado = 'aceptado';
    const guardado = await this.util.prestamosRepo.save(prestamo);

    await this.util.registrarCambioHistorial(guardado, 'aceptacion', guardado.estado, 'Solicitud aceptada.', ejecutor, {
      antes: { estado: estadoAnterior },
      despues: { estado: guardado.estado }
    });

    return this.mapPrestamoDto(guardado);
  }

  async rechazarPrestamo(id: number, motivo: string, ejecutor?: any) {
    const limpioMotivo = String(motivo ?? '').trim();
    if (!limpioMotivo) throw new BadRequestException('Debes proporcionar un motivo.');

    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado !== 'solicitado') throw new BadRequestException('El préstamo no está solicitado.');

    const estadoAnterior = prestamo.estado;
    prestamo.estado = 'rechazado';
    prestamo.motivoRechazo = limpioMotivo;
    const guardado = await this.util.prestamosRepo.save(prestamo);

    await this.util.registrarCambioHistorial(guardado, 'rechazo', guardado.estado, `Solicitud rechazada. Motivo: ${limpioMotivo}`, ejecutor, {
      antes: { estado: estadoAnterior, motivoRechazo: null },
      despues: { estado: guardado.estado, motivoRechazo: limpioMotivo }
    });

    return this.mapPrestamoDto(guardado);
  }

  async despacharPrestamo(id: number, datos: { estadoFisicoEntrega?: string; carnetRetenido?: boolean }, ejecutor?: any) {
    const prestamo = await this.util.prestamosRepo.findOne({ where: { id }, relations: ['estudiante', 'docente', 'itemActivo'] });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const est = prestamo.estudiante;
    const checkEstados = ['despachado', 'vencido'];
    const activosCount = await this.util.prestamosRepo
      .createQueryBuilder('p')
      .where('p.id_estudiante = :idEstudiante', { idEstudiante: est.id })
      .andWhere('p.estado IN (:...estados)', { estados: checkEstados })
      .andWhere('p.carnet_retenido = true')
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.id <> :id', { id: prestamo.id })
      .getCount();

    const activosCanastaCount = await this.util.canastaEstudiantesRepo
      .createQueryBuilder('ce')
      .innerJoin(PrestamoEntidad, 'p', 'p.grupo_canasta = ce.grupoCanasta AND p.estado IN (:...estados) AND p.deleted_at IS NULL', { estados: checkEstados })
      .where('ce.id_estudiante = :idEstudiante', { idEstudiante: est.id })
      .andWhere('ce.carnet_retenido = true')
      .getCount();

    if (activosCount > 0 || activosCanastaCount > 0 || est.carnetRetenidoOverride === true) {
      throw new BadRequestException(`El estudiante ${est.nombre} (${est.carnet}) ya tiene su carnet retenido.`);
    }

    const estadoAnterior = prestamo.estado;
    prestamo.estado = 'despachado';
    prestamo.fechaPrestamo = new Date(); // Update start date/time
    prestamo.estadoFisicoEntrega = datos.estadoFisicoEntrega || 'bueno';

    const retenido = typeof datos.carnetRetenido === 'boolean' ? datos.carnetRetenido : true;
    prestamo.carnetRetenido = retenido;

    if (prestamo.itemActivo) await this.util.marcarItemEnPrestamo(prestamo.itemActivo);

    const guardado = await this.util.prestamosRepo.save(prestamo);
    est.carnetRetenido = retenido;
    await this.util.estudiantesRepo.save(est);
    await this.util.sincronizarCarnetsRetenidosEnLote();

    await this.util.registrarCambioHistorial(guardado, 'despacho', guardado.estado, 'Préstamo despachado.', ejecutor, {
      antes: { estado: estadoAnterior },
      despues: { estado: guardado.estado, estadoFisicoEntrega: guardado.estadoFisicoEntrega }
    });

    return this.mapPrestamoDto(guardado);
  }

  async obtenerHistorialPrestamo(id: number, ejecutor: any) {
    if (ejecutor?.rol !== 'administrador') throw new ForbiddenException('No tienes permiso.');
    const prestamo = await this.util.prestamosRepo.findOne({
      where: { id },
      relations: ['itemActivo', 'itemActivo.activo'],
      withDeleted: true,
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const grupoCanasta = prestamo.grupoCanasta;
    let prestamosEnCanasta: PrestamoEntidad[] = [];
    if (grupoCanasta) {
      prestamosEnCanasta = await this.util.prestamosRepo.find({
        where: { grupoCanasta },
        relations: ['itemActivo', 'itemActivo.activo'],
        withDeleted: true,
      });
    } else {
      prestamosEnCanasta = [prestamo];
    }

    const idsPrestamos = prestamosEnCanasta.map((p) => p.id);
    const todosLosLogs = await this.util.historialRepo.find({
      where: {
        prestamo: {
          id: In(idsPrestamos),
        },
      },
      relations: ['prestamo'],
      withDeleted: true,
      order: {
        fecha: 'ASC',
      },
    });

    let logs = todosLosLogs.filter((l) => l.prestamo.id === id);

    if (logs.length === 0) {
      const fallbackLogs: HistorialPrestamoEntidad[] = [];
      const fechaCreacion = prestamo.createdAt ?? prestamo.fechaPrestamo;
      fallbackLogs.push(this.util.historialRepo.create({
        id: -1,
        fecha: fechaCreacion,
        nombreUsuario: 'Sistema',
        rolUsuario: 'sistema',
        correoUsuario: 'sistema@sgi.local',
        estado: prestamo.fechaDevolucion ? 'pendiente' : 'activo',
        accion: 'creacion_solicitud',
        observaciones: 'Registro inicial de préstamo.',
        detalles: null,
        prestamo,
      }));

      if (prestamo.estado === 'devuelto' || prestamo.estado === 'devuelto_fuera_de_fecha_limite') {
        fallbackLogs.push(this.util.historialRepo.create({
          id: -2,
          fecha: prestamo.fechaDevolucion ?? new Date(),
          nombreUsuario: 'Sistema',
          rolUsuario: 'sistema',
          correoUsuario: 'sistema@sgi.local',
          estado: prestamo.estado,
          accion: 'devolucion',
          observaciones: 'Item devuelto.',
          detalles: null,
          prestamo,
        }));
      }
      logs = fallbackLogs;
    }

    const logsEnriquecidos = logs.map((log) => {
      const estadoActivosCanasta = prestamosEnCanasta.map((p) => {
        const logsDelPrestamo = todosLosLogs.filter(
          (l) => l.prestamo.id === p.id && new Date(l.fecha).getTime() <= new Date(log.fecha).getTime(),
        );
        const ultimoLog = logsDelPrestamo[logsDelPrestamo.length - 1];
        const estadoEnEtapa = ultimoLog ? ultimoLog.estado : p.estado;

        let estadoFinal = estadoEnEtapa;
        const requestEstado = log.estado;

        if (requestEstado === 'solicitado') {
          estadoFinal = 'solicitado';
        } else if (requestEstado === 'aceptado') {
          estadoFinal = 'aceptado';
        } else if (['despachado', 'activo', 'pendiente', 'vencido'].includes(requestEstado)) {
          estadoFinal = estadoEnEtapa === 'no_despachado' ? 'disponible' : 'despachado';
        } else if (['devuelto', 'devuelto_fuera_de_fecha_limite'].includes(requestEstado)) {
          estadoFinal = estadoEnEtapa === 'no_despachado' ? 'disponible' : estadoEnEtapa;
        } else if (requestEstado === 'rechazado') {
          estadoFinal = 'rechazado';
        }

        return {
          idHerramienta: p.codigoHerramienta || '',
          nombre: p.itemActivo?.activo?.nombre ?? 'Activo',
          codigo: p.itemActivo?.codigo_inventario ?? p.codigoHerramienta ?? 'Sin código',
          estado: estadoFinal,
        };
      });

      return {
        ...log,
        estadoActivosCanasta,
      };
    });

    return logsEnriquecidos;
  }

  private parsearIdsPositivos(items: any[]): number[] {
    if (!Array.isArray(items)) return [];
    return Array.from(new Set(items.map((i) => Number(i)).filter((i) => Number.isInteger(i) && i > 0)));
  }

  private construirResumenAsignaciones(e: EstudianteEntidad) {
    const asignaciones = (e.asignacionesCarrera ?? [])
      .filter((a) => a?.carrera && a.cu)
      .map((a) => ({
        carreraId: a.carrera?.id ?? null,
        carrera: a.carrera?.nombre ?? '',
        cu: String(a.cu).trim().toUpperCase(),
        prefijoCu: a.carrera?.prefijoCu ?? null,
      }));
    if (asignaciones.length > 0) return asignaciones;
    return [{
      carreraId: e.carreraRef?.id ?? null,
      carrera: e.carrera ?? '',
      cu: String(e.cu ?? '').trim().toUpperCase(),
      prefijoCu: e.carreraRef?.prefijoCu ?? null,
    }];
  }

  private resolverSubgrupoCoincidente(subgrupos: SubgrupoPrestamoDocenciaEntidad[], participantesIds: number[]) {
    const firma = Array.from(new Set(participantesIds.map((id) => Number(id)).filter((id) => id > 0))).sort((a, b) => a - b).join(',');
    return subgrupos.find((s) => Array.from(new Set((s.estudianteIds ?? []).map((id) => Number(id)))).sort((a, b) => a - b).join(',') === firma) ?? null;
  }

  private construirGruposPrestamoMateria(
    subgrupos: SubgrupoPrestamoDocenciaEntidad[],
    estudianteId: number,
    estudiantesMap: Map<number, EstudianteEntidad>,
  ) {
    return subgrupos
      .filter((s) => (s.estudianteIds ?? []).includes(estudianteId))
      .map((s) => {
        const integrantes = (s.estudianteIds ?? []).map((id) => {
          const est = estudiantesMap.get(id);
          return est ? {
            id: est.id,
            nombre: est.nombre,
            apellido: est.apellido,
            carnet: est.carnet,
            carrera: est.carrera,
            esResponsable: s.responsableEstudianteId === est.id,
          } : null;
        }).filter(Boolean);

        return {
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre ?? null,
          descripcion: s.descripcion ?? null,
          cantidadIntegrantes: Array.isArray(s.estudianteIds) ? s.estudianteIds.length : 0,
          esResponsable: s.responsableEstudianteId === estudianteId,
          estudianteIds: s.estudianteIds ?? [],
          integrantes,
        };
      });
  }

  async obtenerDashboardEstudiante(usuarioId: number) {
    const estudiante = await this.util.estudiantesRepo.findOne({
      where: { usuario: { id: usuarioId } },
      relations: ['carreraRef', 'usuario', 'cus', 'cus.carreras'],
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');

    const participacionesCanasta = await this.util.canastaEstudiantesRepo.find({ where: { estudiante: { id: estudiante.id } } });
    const gruposCanasta = Array.from(new Set(participacionesCanasta.map((p) => p.grupoCanasta?.trim()).filter(Boolean)));
    const condiciones = [{ estudiante: { id: estudiante.id } }, ...gruposCanasta.map((grupoCanasta) => ({ grupoCanasta }))];
    const prestamos = await this.util.prestamosRepo.find({
      where: condiciones as any,
      relations: ['estudiante', 'docente', 'itemActivo', 'itemActivo.activo'],
      order: { fechaPrestamo: 'DESC', id: 'DESC' },
    });

    const gruposInscritos = await this.gruposMateriaDocenciaRepo
      .createQueryBuilder('gr')
      .leftJoinAndSelect('gr.docenteUsuario', 'du')
      .where("gr.estudianteIds @> :id::jsonb", { id: `[${estudiante.id}]` })
      .getMany();

    const asignacionesCarrera = this.construirResumenAsignaciones(estudiante);
    const codigosMateria = Array.from(new Set(gruposInscritos.map((g) => this.util.normalizarCodigoMateriaCatalogo(g.codigoMateria || g.sigla || g.materia || '')).filter(Boolean)));
    const idsMateria = Array.from(new Set(gruposInscritos.map((g) => g.materiaId).filter(Boolean))) as number[];

    let materiasCatalogo: MateriaEntidad[] = [];
    if (codigosMateria.length > 0 || idsMateria.length > 0) {
      const query = this.materiasRepo.createQueryBuilder('m');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (codigosMateria.length > 0) {
        conditions.push('UPPER(m.codigo) IN (:...codigos)');
        params.codigos = codigosMateria;
      }
      if (idsMateria.length > 0) {
        conditions.push('m.id IN (:...ids)');
        params.ids = idsMateria;
      }

      materiasCatalogo = await query.where(conditions.join(' OR '), params).getMany();
    }

    const materiasCatalogoPorCodigo = new Map(materiasCatalogo.map((m) => [this.util.normalizarCodigoMateriaCatalogo(m.codigo), m]));
    const materiasCatalogoPorId = new Map(materiasCatalogo.map((m) => [m.id, m]));

    const user = { id: usuarioId, rol: 'estudiante' };
    const canastas = await this.prestamoCanastaServicio.obtenerCanastasPrestamo(user);

    const docenteUserIds = Array.from(new Set(gruposInscritos.map((g) => g.docenteUsuario?.id).filter(Boolean)));
    const canastasDocenteIds = Array.from(new Set(canastas.map((c) => c.idDocente).filter(Boolean))) as number[];

    const queryDocentes: any[] = [];
    if (docenteUserIds.length > 0) {
      queryDocentes.push(...docenteUserIds.map((id) => ({ usuario: { id } })));
    }
    if (canastasDocenteIds.length > 0) {
      queryDocentes.push(...canastasDocenteIds.map((id) => ({ id })));
    }

    const docentesInfo = queryDocentes.length > 0
      ? await this.util.docentesRepo.find({
          where: queryDocentes,
          relations: ['usuario'],
        })
      : [];
    const docentePorUsuarioId = new Map(docentesInfo.filter((d) => d.usuario?.id).map((d) => [d.usuario!.id, d]));
    const usuarioIdPorDocenteId = new Map(docentesInfo.filter((d) => d.usuario?.id).map((d) => [d.id, d.usuario!.id]));

    const subgruposPrestamo = codigosMateria.length > 0 && gruposInscritos.length > 0
      ? await this.subgruposPrestamoRepo.find({
          where: gruposInscritos.map((g) => ({ grupoMateria: { id: g.id }, habilitado: true })),
          relations: ['grupoMateria', 'grupoMateria.docenteUsuario'],
        })
      : [];

    const todosEstudianteIdsSubgrupos = new Set<number>();
    for (const s of subgruposPrestamo) {
      if (Array.isArray(s.estudianteIds)) {
        for (const id of s.estudianteIds) {
          if (typeof id === 'number') todosEstudianteIdsSubgrupos.add(id);
        }
      }
      if (s.responsableEstudianteId) {
        todosEstudianteIdsSubgrupos.add(s.responsableEstudianteId);
      }
    }

    const estudiantesSubgrupos = todosEstudianteIdsSubgrupos.size > 0
      ? await this.util.estudiantesRepo.createQueryBuilder('e')
          .where('e.id IN (:...ids)', { ids: Array.from(todosEstudianteIdsSubgrupos) })
          .getMany()
      : [];
    const estudiantesSubgruposMap = new Map(estudiantesSubgrupos.map((e) => [e.id, e]));

    const subgruposPorGrupo = new Map<string, SubgrupoPrestamoDocenciaEntidad[]>();
    for (const s of subgruposPrestamo) {
      if (!s.grupoMateria?.id) continue;
      const lista = subgruposPorGrupo.get(s.grupoMateria.id) ?? [];
      lista.push(s);
      subgruposPorGrupo.set(s.grupoMateria.id, lista);
    }

    const limpiarNombreMateria = (n: string | null | undefined): string | null => {
      if (!n) return null;
      const limpio = n.trim();
      if (limpio.toLowerCase() === 'sin nombre' || limpio === '') return null;
      return limpio;
    };

    const materiasInscritas = gruposInscritos.map((g) => {
      const mc = (g.materiaId ? materiasCatalogoPorId.get(g.materiaId) : null)
        || materiasCatalogoPorCodigo.get(this.util.normalizarCodigoMateriaCatalogo(g.codigoMateria || g.sigla || g.materia || ''));
      const d = g.docenteUsuario ? docentePorUsuarioId.get(g.docenteUsuario.id) : null;
      
      const asignacionesDelGrupo = g.carrerasPorEstudiante?.[estudiante.id]
        ? asignacionesCarrera.filter(a => g.carrerasPorEstudiante![estudiante.id].includes(a.carrera))
        : asignacionesCarrera;

      return {
        grupoId: g.id,
        materiaCodigo: g.codigoMateria || g.sigla || g.materia || mc?.codigo || null,
        materiaNombre: limpiarNombreMateria(g.nombreMateria) || limpiarNombreMateria(g.nombre) || mc?.nombre || g.materia || null,
        docente: d ? `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim() : (g.docenteUsuario ? g.docenteUsuario.correo : null),
        grupo: g.grupo,
        maxEstudiantesGrupo: g.maxEstudiantesGrupo ?? 3,
        carreras: asignacionesDelGrupo.map((a) => ({
          carreraId: a.carreraId,
          carrera: a.carrera,
          cu: a.cu,
          prefijoCu: a.prefijoCu,
        })),
        gruposPrestamo: this.construirGruposPrestamoMateria(subgruposPorGrupo.get(g.id) ?? [], estudiante.id, estudiantesSubgruposMap),
      };
    });

    const materiasPorCarreraMap = new Map<string, any>();
    for (const m of materiasInscritas) {
      const carrerasM = m.carreras.length > 0 ? m.carreras : asignacionesCarrera;
      for (const c of carrerasM) {
        const clave = `${c.carreraId ?? 'sin-id'}:${c.carrera}`;
        const actual = materiasPorCarreraMap.get(clave) ?? { carreraId: c.carreraId, carrera: c.carrera, cu: c.cu, prefijoCu: c.prefijoCu, materias: [] };
        actual.materias.push(m);
        materiasPorCarreraMap.set(clave, actual);
      }
    }

    const prestamosResumen = canastas.map((c) => {
      const esGrupal = !!c.grupoCanasta;
      let materiaGrupoId = null;
      let materiaCodigo = null;
      let materiaNombre = null;
      let grupoPrestamoId = null;
      let grupoPrestamoCodigo = null;
      let grupoPrestamoNombre = null;
      let esLider = false;

      const docenteUsuarioId = c.idDocente ? usuarioIdPorDocenteId.get(c.idDocente) : null;

      // Find subgrupo match
      const matchSg = subgruposPrestamo.find(sg => 
        sg.grupoMateria?.docenteUsuario?.id === docenteUsuarioId && 
        sg.estudianteIds?.includes(estudiante.id)
      );

      if (matchSg) {
        materiaGrupoId = matchSg.grupoMateria.id;
        const mc = (matchSg.grupoMateria.materiaId ? materiasCatalogoPorId.get(matchSg.grupoMateria.materiaId) : null)
          || materiasCatalogoPorCodigo.get(this.util.normalizarCodigoMateriaCatalogo(matchSg.grupoMateria.codigoMateria || matchSg.grupoMateria.sigla || matchSg.grupoMateria.materia || ''));
        materiaCodigo = matchSg.grupoMateria.codigoMateria || matchSg.grupoMateria.sigla || matchSg.grupoMateria.materia || mc?.codigo || null;
        materiaNombre = limpiarNombreMateria(matchSg.grupoMateria.nombreMateria) || limpiarNombreMateria(matchSg.grupoMateria.nombre) || mc?.nombre || matchSg.grupoMateria.materia || null;
        grupoPrestamoId = matchSg.id;
        grupoPrestamoCodigo = matchSg.codigo;
        grupoPrestamoNombre = matchSg.nombre || matchSg.codigo;
        esLider = matchSg.responsableEstudianteId === estudiante.id;
      } else {
        // Fallback: match by subject group docente
        const matchG = gruposInscritos.find(g => g.docenteUsuario?.id === docenteUsuarioId);
        if (matchG) {
          materiaGrupoId = matchG.id;
          const mc = (matchG.materiaId ? materiasCatalogoPorId.get(matchG.materiaId) : null)
            || materiasCatalogoPorCodigo.get(this.util.normalizarCodigoMateriaCatalogo(matchG.codigoMateria || matchG.sigla || matchG.materia || ''));
          materiaCodigo = matchG.codigoMateria || matchG.sigla || matchG.materia || mc?.codigo || null;
          materiaNombre = limpiarNombreMateria(matchG.nombreMateria) || limpiarNombreMateria(matchG.nombre) || mc?.nombre || matchG.materia || null;
        }
      }

      return {
        ...c,
        esPrestamoGrupal: esGrupal,
        esLiderGrupo: esLider,
        puedeDescargarPdf: esGrupal,
        grupoPrestamoId,
        grupoPrestamoCodigo,
        grupoPrestamoNombre,
        materiaGrupoId,
        materiaCodigo,
        materiaNombre,
        pdfUrl: null,
      };
    });

    const dashboardPrestamos = prestamos.map((p) => this.mapPrestamoDto(p));

    return {
      perfil: {
        id: estudiante.id,
        carnet: estudiante.carnet,
        cu: asignacionesCarrera[0]?.cu ?? estudiante.cu,
        cus: asignacionesCarrera.map((a) => a.cu),
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        carrera: asignacionesCarrera[0]?.carrera ?? estudiante.carrera,
        carreras: asignacionesCarrera.map((a) => a.carrera),
        asignacionesCarrera,
        carnetRetenido: estudiante.carnetRetenido,
        cusRetenidos: estudiante.carnetRetenido ? Array.from(new Set(asignacionesCarrera.map((a) => a.cu).filter(Boolean))) : [],
      },
      materias: materiasInscritas,
      materiasPorCarrera: Array.from(materiasPorCarreraMap.values()),
      prestamos: dashboardPrestamos,
      prestamosResumen,
    };
  }
  async obtenerEstudiantes(): Promise<EstudianteEntidad[]> {
    await this.util.marcarVencidosEnLote();
    await this.util.sincronizarCarnetsRetenidosEnLote();
    return this.util.estudiantesRepo.find({
      order: { apellido: 'ASC', name: 'ASC' } as any,
      relations: ['carreraRef', 'cus', 'cus.carreras'],
    });
  }

  async obtenerDocentes(): Promise<any[]> {
    const docentes = await this.util.docentesRepo.find({
      relations: ['usuario'],
      order: { codigo: 'ASC' },
    });
    return docentes.map((d) => ({
      id: d.id,
      correo: d.usuario?.correo ?? '',
      codigo: d.codigo ?? '',
      nombre: d.nombre ?? '',
      apellido: d.apellido ?? '',
      materia: d.materia ?? '',
      carnet: d.ci ?? '',
      fechaNacimiento: d.fechaNacimiento ?? null,
      materias: (d.materiasAsignadas ?? []).map((codigo) => ({ id: codigo, codigo, nombre: null })),
    }));
  }

  async editarEstudiante(id: number, datos: any) {
    const estudiante = await this.util.estudiantesRepo.findOne({ where: { id } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (typeof datos.carnetRetenidoOverride === 'boolean' || datos.carnetRetenidoOverride === null) {
      estudiante.carnetRetenidoOverride = datos.carnetRetenidoOverride;
      if (typeof datos.carnetRetenidoOverride === 'boolean') {
        estudiante.carnetRetenido = datos.carnetRetenidoOverride;
      }
    } else if (typeof datos.carnetRetenido === 'boolean') {
      estudiante.carnetRetenidoOverride = datos.carnetRetenido;
      estudiante.carnetRetenido = datos.carnetRetenido;
    }
    const guardado = await this.util.estudiantesRepo.save(estudiante);
    if (guardado.carnetRetenidoOverride === null) {
      await this.util.sincronizarCarnetRetenidoEstudiante(guardado.id);
    }
    return guardado;
  }

  async obtenerCarreras() {
    return this.carreraServicio.obtenerCarreras();
  }
  async crearCarrera(datos: any) {
    return this.carreraServicio.crearCarrera(datos);
  }
  async editarCarrera(id: number, datos: any) {
    return this.carreraServicio.editarCarrera(id, datos);
  }
  async eliminarCarrera(id: number) {
    return this.carreraServicio.eliminarCarrera(id);
  }

  async obtenerMaterias() {
    return this.materiaServicio.obtenerMaterias();
  }
  async crearMateria(datos: any) {
    return this.materiaServicio.crearMateria(datos);
  }
  async editarMateria(id: number, datos: any) {
    return this.materiaServicio.editarMateria(id, datos);
  }
  async eliminarMateria(id: number) {
    return this.materiaServicio.eliminarMateria(id);
  }

  async obtenerCanastasPrestamo(ejecutor?: any) {
    return this.prestamoCanastaServicio.obtenerCanastasPrestamo(ejecutor);
  }
  async crearCanastaPrestamo(datos: any, ejecutor?: any) {
    return this.prestamoCanastaServicio.crearCanastaPrestamo(datos, ejecutor);
  }
  async editarCanastaPrestamo(canastaId: string, datos: any, ejecutor?: any) {
    return this.prestamoCanastaServicio.editarCanastaPrestamo(canastaId, datos, ejecutor);
  }
  async extenderCanastaPrestamo(canastaId: string, fechaDevolucion: string, ejecutor?: any) {
    return this.prestamoCanastaServicio.extenderCanastaPrestamo(canastaId, fechaDevolucion, ejecutor);
  }
  async aceptarCanastaPrestamo(canastaId: string, ejecutor?: any) {
    return this.prestamoCanastaServicio.aceptarCanastaPrestamo(canastaId, ejecutor);
  }
  async rechazarCanastaPrestamo(canastaId: string, motivo: string, ejecutor?: any) {
    return this.prestamoCanastaServicio.rechazarCanastaPrestamo(canastaId, motivo, ejecutor);
  }
  async despacharCanastaPrestamo(canastaId: string, datos: any, ejecutor?: any) {
    return this.prestamoCanastaServicio.despacharCanastaPrestamo(canastaId, datos, ejecutor);
  }
  async devolverCanastaPrestamo(canastaId: string, ejecutor?: any) {
    return this.prestamoCanastaServicio.devolverCanastaPrestamo(canastaId, ejecutor);
  }
  async devolverCanastaPrestamoCompleto(canastaId: string, datos: any, ejecutor?: any) {
    return this.prestamoCanastaServicio.devolverCanastaPrestamoCompleto(canastaId, datos, ejecutor);
  }
  async eliminarCanastaPrestamo(canastaId: string, ejecutor?: any) {
    return this.prestamoCanastaServicio.eliminarCanastaPrestamo(canastaId, ejecutor);
  }
}
