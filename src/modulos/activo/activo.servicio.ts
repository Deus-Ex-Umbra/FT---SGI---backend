import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivoFijo } from './activo_fijo.entidad';
import { ItemActivo } from './item_activo.entidad';
import { TRANSICIONES_ESTADO_ITEM, normalizarEstadoItem, requiereJustificacionTransicion } from './reglas-estado-item';
import { AuditoriaServicio } from '../auditoria/auditoria.servicio';

@Injectable()
export class ActivoServicio {
    constructor(
        @InjectRepository(ActivoFijo)
        private readonly activoFijoRepositorio: Repository<ActivoFijo>,
        @InjectRepository(ItemActivo)
        private readonly itemActivoRepositorio: Repository<ItemActivo>,
        private readonly auditoriaServicio: AuditoriaServicio,
    ) { }

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
        return await this.activoFijoRepositorio.find({ relations: ['items'] });
    }

    async obtenerItems(): Promise<ItemActivo[]> {
        return await this.itemActivoRepositorio.find({ relations: ['activo'] });
    }

    async editarActivoFijo(id: number, datos: Partial<{ nombre: string }>): Promise<ActivoFijo> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id }, relations: ['items'] });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');
        const nombreAnterior = activo.nombre;

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            activo.nombre = datos.nombre.trim();
        }

        const actualizado = await this.activoFijoRepositorio.save(activo);
        await this.auditoriaServicio.registrarEventoSilencioso({
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
        await this.auditoriaServicio.registrarEventoSilencioso({
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
}
