import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContenedorActivo } from './contenedor_activo.entidad';
import { ActivoFijo } from './activo_fijo.entidad';
import { ItemActivo } from './item_activo.entidad';
import { TRANSICIONES_ESTADO_ITEM, normalizarEstadoItem, requiereJustificacionTransicion } from './reglas-estado-item';

@Injectable()
export class ActivoServicio {
    private readonly registrarEventoInterno = async (_input: unknown) => undefined;

    constructor(
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(ActivoFijo)
        private readonly activoFijoRepositorio: Repository<ActivoFijo>,
        @InjectRepository(ItemActivo)
        private readonly itemActivoRepositorio: Repository<ItemActivo>,
    ) { }

    private async obtenerContenedorPorId(idContenedor?: number): Promise<ContenedorActivo | null> {
        if (!idContenedor) return null;
        const contenedor = await this.contenedorActivoRepositorio.findOne({ where: { id: Number(idContenedor) } });
        if (!contenedor) throw new NotFoundException('Contenedor de activos no encontrado.');
        return contenedor;
    }

    async obtenerContenedores(): Promise<ContenedorActivo[]> {
        return this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .orderBy('ca.id', 'ASC')
            .getMany();
    }

    async crearContenedor(datos: { nombre: string; ubicacion: string }): Promise<ContenedorActivo> {
        const nombre = datos.nombre?.trim();
        const ubicacion = datos.ubicacion?.trim();
        if (!nombre || !ubicacion) {
            throw new BadRequestException('Nombre y ubicación son obligatorios para crear contenedor.');
        }
        const contenedor = this.contenedorActivoRepositorio.create({ nombre, ubicacion });
        return this.contenedorActivoRepositorio.save(contenedor);
    }

    async editarContenedor(id: number, datos: Partial<{ nombre: string; ubicacion: string }>): Promise<ContenedorActivo> {
        const contenedor = await this.contenedorActivoRepositorio.findOne({ where: { id } });
        if (!contenedor) throw new NotFoundException('Contenedor de activos no encontrado.');

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            contenedor.nombre = datos.nombre.trim();
        }
        if (typeof datos.ubicacion === 'string' && datos.ubicacion.trim()) {
            contenedor.ubicacion = datos.ubicacion.trim();
        }

        return this.contenedorActivoRepositorio.save(contenedor);
    }

    private validarTransicionEstado(item: ItemActivo, nuevoEstadoRaw: string, fechaRetiroNueva?: Date, justificacion?: string) {
        const estadoActual = normalizarEstadoItem(item.estado);
        const nuevoEstado = normalizarEstadoItem(nuevoEstadoRaw);

        if (!nuevoEstado) {
            throw new BadRequestException('Estado no valido para el item activo.');
        }
        if (!estadoActual) {
            throw new BadRequestException(`El estado actual del item (${item.estado}) no es valido en la plantilla de transiciones.`);
        }
        if (estadoActual === nuevoEstado) return nuevoEstado;

        const permitidos = TRANSICIONES_ESTADO_ITEM[estadoActual];
        if (!permitidos.includes(nuevoEstado)) {
            throw new BadRequestException(
                `Transicion de estado no permitida: ${estadoActual} -> ${nuevoEstado}. Permitidos: ${permitidos.join(', ') || 'ninguno'}`,
            );
        }

        if (requiereJustificacionTransicion(estadoActual, nuevoEstado) && !justificacion?.trim()) {
            throw new BadRequestException(
                `La transicion ${estadoActual} -> ${nuevoEstado} requiere nota de justificacion obligatoria.`,
            );
        }

        if (estadoActual === 'en_prestamo' && nuevoEstado === 'dado_de_baja') {
            throw new BadRequestException('No se puede pasar de en_prestamo a dado_de_baja sin pasar por revision.');
        }

        const fechaRetiroEfectiva = fechaRetiroNueva ?? item.fechaRetiro;
        if (nuevoEstado === 'dado_de_baja' && !fechaRetiroEfectiva) {
            throw new BadRequestException('Para estado dado_de_baja debes registrar fecha de retiro.');
        }

        return nuevoEstado;
    }

    async obtenerTransicionesPermitidas(id: number) {
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        const estadoActual = normalizarEstadoItem(item.estado);
        if (!estadoActual) {
            throw new BadRequestException(`Estado actual no reconocido en plantilla: ${item.estado}`);
        }

        return {
            itemId: item.id,
            codigoInventario: item.codigoInventario,
            estadoActual,
            transiciones: TRANSICIONES_ESTADO_ITEM[estadoActual].map((estadoDestino) => ({
                estadoDestino,
                requiereJustificacion: requiereJustificacionTransicion(estadoActual, estadoDestino),
            })),
        };
    }

    async obtenerTodosFijos(): Promise<ActivoFijo[]> {
        return await this.activoFijoRepositorio
            .createQueryBuilder('af')
            .leftJoinAndSelect('af.contenedor', 'ca', 'ca.deleted_at IS NULL')
            .leftJoinAndSelect('af.items', 'it', 'it.deleted_at IS NULL')
            .where('af.deleted_at IS NULL')
            .getMany();
    }

    async obtenerItems(): Promise<ItemActivo[]> {
        return await this.itemActivoRepositorio
            .createQueryBuilder('it')
            .leftJoinAndSelect('it.activo', 'af', 'af.deleted_at IS NULL')
            .where('it.deleted_at IS NULL')
            .getMany();
    }

    async crearActivoFijo(datos: { nombre: string; idContenedor?: number }): Promise<ActivoFijo> {
        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre del activo fijo es obligatorio.');
        }

        const contenedor = await this.obtenerContenedorPorId(datos.idContenedor);

        const activo = this.activoFijoRepositorio.create({ nombre, contenedor });
        const guardado = await this.activoFijoRepositorio.save(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: guardado.id,
            accion: 'crear',
            detalle: { id: guardado.id, nombre: guardado.nombre },
        });
        return guardado;
    }

    async crearItemActivo(
        datos: {
            idActivo: number;
            codigoInventario: string;
            fechaEntrega?: string | null;
            fechaRetiro?: string | null;
            estado?: string;
            observaciones?: string;
            precio?: number;
        },
    ): Promise<ItemActivo> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id: Number(datos.idActivo) } });
        if (!activo) {
            throw new NotFoundException('Activo fijo no encontrado para asociar el item.');
        }

        const codigoInventario = datos.codigoInventario?.trim();
        if (!codigoInventario) {
            throw new BadRequestException('El código de inventario es obligatorio.');
        }

        const estadoNormalizado = normalizarEstadoItem(datos.estado ?? 'buen_estado');
        if (!estadoNormalizado) {
            throw new BadRequestException('Estado no válido para el item activo.');
        }

        const item = this.itemActivoRepositorio.create({
            activo,
            codigoInventario,
            fechaEntrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined,
            fechaRetiro: datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined,
            estado: estadoNormalizado,
            observaciones: datos.observaciones?.trim() || '',
            precio: Number(datos.precio ?? 0),
        });

        const guardado = await this.itemActivoRepositorio.save(item);
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: guardado.id,
            accion: 'crear',
            detalle: {
                id: guardado.id,
                idActivo: activo.id,
                codigoInventario: guardado.codigoInventario,
                estado: guardado.estado,
            },
        });

        return guardado;
    }

    async editarActivoFijo(id: number, datos: Partial<{ nombre: string }>): Promise<ActivoFijo> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id }, relations: ['items'] });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');
        const nombreAnterior = activo.nombre;

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            activo.nombre = datos.nombre.trim();
        }

        const actualizado = await this.activoFijoRepositorio.save(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: { nombre: nombreAnterior },
                despues: { nombre: actualizado.nombre },
            },
        });
        return actualizado;
    }

    async editarItemActivo(
        id: number,
        datos: Partial<{
            codigoInventario: string;
            fechaEntrega: string | null;
            fechaRetiro: string | null;
            estado: string;
            observaciones: string;
            precio: number;
            justificacion: string;
        }>,
    ): Promise<ItemActivo> {
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');
        const snapshotAntes = {
            codigoInventario: item.codigoInventario,
            fechaEntrega: item.fechaEntrega,
            fechaRetiro: item.fechaRetiro,
            estado: item.estado,
            observaciones: item.observaciones,
            precio: item.precio,
        };

        if (typeof datos.codigoInventario === 'string' && datos.codigoInventario.trim()) {
            item.codigoInventario = datos.codigoInventario.trim();
        }
        if (datos.fechaEntrega !== undefined) {
            item.fechaEntrega = datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined;
        }
        const fechaRetiroNueva = datos.fechaRetiro !== undefined
            ? (datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined)
            : undefined;
        if (datos.fechaRetiro !== undefined) {
            item.fechaRetiro = fechaRetiroNueva;
        }
        if (typeof datos.estado === 'string' && datos.estado.trim()) {
            const estadoValidado = this.validarTransicionEstado(item, datos.estado.trim(), fechaRetiroNueva, datos.justificacion ?? datos.observaciones);
            item.estado = estadoValidado;
        }
        if (typeof datos.observaciones === 'string') {
            item.observaciones = datos.observaciones;
        }
        if (typeof datos.precio === 'number' && Number.isFinite(datos.precio)) {
            item.precio = datos.precio;
        }

        const actualizado = await this.itemActivoRepositorio.save(item);
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: snapshotAntes,
                despues: {
                    codigoInventario: actualizado.codigoInventario,
                    fechaEntrega: actualizado.fechaEntrega,
                    fechaRetiro: actualizado.fechaRetiro,
                    estado: actualizado.estado,
                    observaciones: actualizado.observaciones,
                    precio: actualizado.precio,
                },
                justificacion: datos.justificacion ?? null,
            },
        });
        return actualizado;
    }

    async eliminarActivoFijo(id: number): Promise<void> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id }, relations: ['items'] });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');

        const items = activo.items ?? [];
        if (items.length > 0) {
            await this.itemActivoRepositorio.softRemove(items);
        }

        await this.activoFijoRepositorio.softRemove(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: activo.id,
            accion: 'eliminar',
            detalle: {
                id: activo.id,
                nombre: activo.nombre,
                itemsDescartados: items.length,
            },
        });
    }
}
