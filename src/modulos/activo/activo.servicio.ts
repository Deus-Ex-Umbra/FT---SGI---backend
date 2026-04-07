import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoFijo } from './entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './entidades/item-activo-fijo.entidad';
import { TRANSICIONES_ESTADO_ITEM, normalizarEstadoItem, requiereJustificacionTransicion } from './dominio/reglas-estado-item';
import { normalizarEstadoFisicoItem } from './dominio/reglas-estado-fisico-item';

type ItemActivoFijoApi = {
    id: string;
    codigoInventario?: string | null;
    codigoUnico?: string | null;
    // En la UI, "código de sistema" se usa como identificador interno.
    // Si existe un código externo en DB (`codigo_sistema`), lo preferimos; si no, usamos el UUID `id`.
    codigoSistema?: string | null;
    ubicacion?: string;
    ue?: string;
    descripcion?: string;
    fechaEntrega?: string;
    fechaRetiro?: string;
    estado: string;
    estadoFisico?: string;
    observaciones?: string;
    precio?: number;
};

type ContenedorActivoApi = {
    id: number;
    nombre: string;
    ubicacion: string;
};

type ActivoFijoApi = {
    id: number;
    nombre: string;
    categoria: string;
    descripcion?: string;
    contenedor?: ContenedorActivoApi | null;
    items: ItemActivoFijoApi[];
};

const serializarFechaApi = (valor?: unknown): string | undefined => {
    if (!valor) return undefined;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number') return new Date(valor).toISOString();
    return String(valor);
};

@Injectable()
export class ActivoServicio {
    private readonly registrarEventoInterno = async (_input: unknown) => undefined;

    constructor(
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(ActivoFijo)
        private readonly activoFijoRepositorio: Repository<ActivoFijo>,
        @InjectRepository(ItemActivoFijo)
        private readonly itemActivoRepositorio: Repository<ItemActivoFijo>,
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

        const existente = await this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .andWhere('LOWER(TRIM(ca.nombre)) = LOWER(:nombre)', { nombre })
            .andWhere('LOWER(TRIM(ca.ubicacion)) = LOWER(:ubicacion)', { ubicacion })
            .getOne();

        if (existente) return existente;

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

        const duplicado = await this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .andWhere('ca.id <> :id', { id })
            .andWhere('LOWER(TRIM(ca.nombre)) = LOWER(:nombre)', { nombre: contenedor.nombre })
            .andWhere('LOWER(TRIM(ca.ubicacion)) = LOWER(:ubicacion)', { ubicacion: contenedor.ubicacion })
            .getOne();

        if (duplicado) {
            throw new BadRequestException('Ya existe un contenedor de activos con ese nombre y ubicación.');
        }

        return this.contenedorActivoRepositorio.save(contenedor);
    }

    private validarTransicionEstado(item: ItemActivoFijo, nuevoEstadoRaw: string, fechaRetiroNueva?: Date, justificacion?: string) {
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

        const fechaRetiroEfectiva = fechaRetiroNueva ?? item.fecha_retiro;
        if (nuevoEstado === 'dado_de_baja' && !fechaRetiroEfectiva) {
            throw new BadRequestException('Para estado dado_de_baja debes registrar fecha de retiro.');
        }

        // Regla de negocio: solo se permite dar de baja cuando el estado físico es malo.
        if (nuevoEstado === 'dado_de_baja') {
            const fisico = normalizarEstadoFisicoItem(item.estado_fisico);
            if (fisico !== 'malo') {
                throw new BadRequestException('Para dar de baja el equipo, el estado físico debe ser "malo".');
            }
        }

        return nuevoEstado;
    }

    async obtenerTransicionesPermitidas(id: string) {
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        const estadoActual = normalizarEstadoItem(item.estado);
        if (!estadoActual) {
            throw new BadRequestException(`Estado actual no reconocido en plantilla: ${item.estado}`);
        }

        const estadoFisico = normalizarEstadoFisicoItem(item.estado_fisico) ?? 'bueno';

        return {
            itemId: item.id,
            codigoInventario: item.codigo_inventario ?? '',
            estadoActual,
            estadoFisico,
            transiciones: (TRANSICIONES_ESTADO_ITEM[estadoActual] ?? []).map((estadoDestino) => ({
                estadoDestino,
                requiereJustificacion: requiereJustificacionTransicion(estadoActual, estadoDestino),
            })),
        };
    }

    async obtenerTodosFijos(): Promise<ActivoFijoApi[]> {
        const fijos = await this.activoFijoRepositorio
            .createQueryBuilder('af')
            .leftJoinAndSelect('af.contenedor', 'ca', 'ca.deleted_at IS NULL')
            .leftJoinAndSelect('af.items', 'it', 'it.deleted_at IS NULL')
            .where('af.deleted_at IS NULL')
            .getMany();

        // Restricción por defecto: ocultar items extraviados (soft-delete temporal via restricción de consultas).
        for (const af of fijos) {
            af.items = (af.items ?? []).filter((it) => normalizarEstadoItem(it.estado) !== 'extraviado');
        }

        return fijos.map((af) => ({
            id: af.id,
            nombre: af.nombre,
            categoria: af.categoria,
            descripcion: af.descripcion,
            contenedor: af.contenedor
                ? {
                    id: af.contenedor.id,
                    nombre: af.contenedor.nombre,
                    ubicacion: af.contenedor.ubicacion,
                }
                : null,
            items: (af.items ?? []).map((it) => ({
                id: it.id,
                codigoInventario: it.codigo_inventario ?? null,
                codigoUnico: it.codigo_unico ?? null,
                codigoSistema: it.codigo_sistema ?? (!it.codigo_unico && !it.codigo_inventario ? it.id : null),
                ubicacion: it.ubicacion,
                ue: it.ue,
                descripcion: it.descripcion,
                fechaEntrega: serializarFechaApi(it.fecha_entrega),
                fechaRetiro: serializarFechaApi(it.fecha_retiro),
                estado: it.estado,
                estadoFisico: it.estado_fisico,
                observaciones: it.observaciones,
                precio: Number(it.precio ?? 0),
            })),
        }));
    }

    async obtenerItems(): Promise<ItemActivoFijo[]> {
        const items = await this.itemActivoRepositorio
            .createQueryBuilder('it')
            .leftJoinAndSelect('it.activo', 'af', 'af.deleted_at IS NULL')
            .where('it.deleted_at IS NULL')
            .getMany();

        // Restricción por defecto: ocultar items extraviados.
        return items.filter((it) => normalizarEstadoItem(it.estado) !== 'extraviado');
    }

    async crearActivoFijo(datos: {
        nombre: string;
        idContenedor?: number;
        categoria?: string;
        descripcion?: string;
    }): Promise<ActivoFijo> {
        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre del activo fijo es obligatorio.');
        }

        const contenedor = await this.obtenerContenedorPorId(datos.idContenedor);

        const categoria = typeof datos.categoria === 'string' && datos.categoria.trim()
            ? datos.categoria.trim()
            : 'General';
        const descripcion = typeof datos.descripcion === 'string' && datos.descripcion.trim()
            ? datos.descripcion.trim()
            : undefined;

        const activo = this.activoFijoRepositorio.create({
            nombre,
            contenedor,
            categoria,
            descripcion,
        });
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
            idActivo: string | number;
            codigoInventario?: string;
            codigoUnico?: string;
            codigoSistema?: string;
            ubicacion?: string;
            ue?: string;
            descripcion?: string;
            fechaEntrega?: string | null;
            fechaRetiro?: string | null;
            estado?: string;
            estadoFisico?: string;
            observaciones?: string;
            precio?: number;
        },
    ): Promise<ItemActivoFijo> {
        const idActivo = Number(datos.idActivo);
        if (!Number.isFinite(idActivo) || idActivo <= 0) {
            throw new BadRequestException('El idActivo debe ser un número válido.');
        }

        const activo = await this.activoFijoRepositorio.findOne({ where: { id: idActivo }, relations: ['contenedor'] });
        if (!activo) {
            throw new NotFoundException('Activo fijo no encontrado para asociar el item.');
        }

        const codigoInventario = typeof datos.codigoInventario === 'string' ? datos.codigoInventario.trim() : '';
        const codigoInventarioFinal = codigoInventario || null;

        const codigoUnico = typeof datos.codigoUnico === 'string' ? datos.codigoUnico.trim() : '';
        const codigoUnicoFinal = codigoUnico || null;

        const codigoSistema = typeof datos.codigoSistema === 'string' ? datos.codigoSistema.trim() : '';
        const codigoSistemaFinal = codigoSistema || null;

        const estadoNormalizado = normalizarEstadoItem(datos.estado ?? 'disponible');
        if (!estadoNormalizado) {
            throw new BadRequestException('Estado no válido para el item activo.');
        }

        const estadoFisicoNormalizado = normalizarEstadoFisicoItem(datos.estadoFisico ?? 'bueno');
        if (!estadoFisicoNormalizado) {
            throw new BadRequestException('Estado físico no válido para el item activo.');
        }

        const ue = typeof datos.ue === 'string' && datos.ue.trim()
            ? datos.ue.trim()
            : (activo.contenedor?.ubicacion?.trim() || undefined);
        const descripcion = typeof datos.descripcion === 'string' && datos.descripcion.trim()
            ? datos.descripcion.trim()
            : undefined;

        const item = this.itemActivoRepositorio.create({
            activo,
            codigo_inventario: codigoInventarioFinal,
            codigo_unico: codigoUnicoFinal,
            codigo_sistema: codigoSistemaFinal,
            ubicacion: typeof datos.ubicacion === 'string' && datos.ubicacion.trim() ? datos.ubicacion.trim() : undefined,
            ue,
            descripcion,
            fecha_entrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined,
            fecha_retiro: datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined,
            estado: estadoNormalizado,
            estado_fisico: estadoFisicoNormalizado,
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
                codigoInventario: guardado.codigo_inventario ?? null,
                estado: guardado.estado,
            },
        });

        return guardado;
    }

    async editarActivoFijo(
        id: number,
        datos: Partial<{ nombre: string; categoria: string; descripcion: string }>,
    ): Promise<ActivoFijo> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id: Number(id) }, relations: ['items'] });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');
        const nombreAnterior = activo.nombre;

        const categoriaAnterior = activo.categoria;
        const descripcionAnterior = activo.descripcion;

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            activo.nombre = datos.nombre.trim();
        }

        if (typeof datos.categoria === 'string') {
            const nuevo = datos.categoria.trim();
            activo.categoria = nuevo || 'General';
        }

        if (typeof datos.descripcion === 'string') {
            const nuevo = datos.descripcion.trim();
            activo.descripcion = nuevo || undefined;
        }

        const actualizado = await this.activoFijoRepositorio.save(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: {
                    nombre: nombreAnterior,
                    categoria: categoriaAnterior,
                    descripcion: descripcionAnterior,
                },
                despues: {
                    nombre: actualizado.nombre,
                    categoria: actualizado.categoria,
                    descripcion: actualizado.descripcion,
                },
            },
        });
        return actualizado;
    }

    async editarItemActivo(
        id: string,
        datos: Partial<{
            codigoInventario: string;
            codigoUnico: string;
            codigoSistema: string;
            fechaEntrega: string | null;
            fechaRetiro: string | null;
            estado: string;
            estadoFisico: string;
            ubicacion: string;
            ue: string;
            descripcion: string;
            observaciones: string;
            precio: number;
            justificacion: string;
        }>,
    ): Promise<ItemActivoFijo> {
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');
        const snapshotAntes = {
            codigoInventario: item.codigo_inventario,
            codigoUnico: item.codigo_unico,
            codigoSistema: item.codigo_sistema,
            fechaEntrega: item.fecha_entrega,
            fechaRetiro: item.fecha_retiro,
            estado: item.estado,
            estadoFisico: item.estado_fisico,
            ubicacion: item.ubicacion,
            ue: item.ue,
            descripcion: item.descripcion,
            observaciones: item.observaciones,
            precio: item.precio,
        };

        if (typeof datos.codigoInventario === 'string') {
            const nuevo = datos.codigoInventario.trim();
            item.codigo_inventario = nuevo || null;
        }
        if (typeof datos.codigoUnico === 'string') {
            const nuevo = datos.codigoUnico.trim();
            item.codigo_unico = nuevo || null;
        }
        if (typeof datos.codigoSistema === 'string') {
            const nuevo = datos.codigoSistema.trim();
            item.codigo_sistema = nuevo || null;
        }
        if (typeof datos.ubicacion === 'string') {
            item.ubicacion = datos.ubicacion.trim() || undefined;
        }
        if (typeof datos.ue === 'string') {
            item.ue = datos.ue.trim() || undefined;
        }
        if (typeof datos.descripcion === 'string') {
            item.descripcion = datos.descripcion.trim() || undefined;
        }
        if (datos.fechaEntrega !== undefined) {
            item.fecha_entrega = datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined;
        }
        const fechaRetiroNueva = datos.fechaRetiro !== undefined
            ? (datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined)
            : undefined;
        if (datos.fechaRetiro !== undefined) {
            item.fecha_retiro = fechaRetiroNueva;
        }

        if (typeof datos.estadoFisico === 'string' && datos.estadoFisico.trim()) {
            const fisico = normalizarEstadoFisicoItem(datos.estadoFisico);
            if (!fisico) {
                throw new BadRequestException('Estado físico no válido para el item activo.');
            }
            item.estado_fisico = fisico;
        }

        if (typeof datos.estado === 'string' && datos.estado.trim()) {
            const estadoValidado = this.validarTransicionEstado(item, datos.estado.trim(), fechaRetiroNueva, datos.justificacion ?? datos.observaciones);
            item.estado = estadoValidado;
        }
        if (typeof datos.observaciones === 'string') {
            item.observaciones = datos.observaciones;
        }
        if (datos.precio !== undefined) {
            const precio = Number(datos.precio);
            if (Number.isFinite(precio)) item.precio = precio;
        }

        const actualizado = await this.itemActivoRepositorio.save(item);

        // Soft delete definitivo al darse de baja.
        if (normalizarEstadoItem(actualizado.estado) === 'dado_de_baja') {
            await this.itemActivoRepositorio.softRemove(actualizado);
        }
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: snapshotAntes,
                despues: {
                    codigoInventario: actualizado.codigo_inventario ?? null,
                    codigoUnico: actualizado.codigo_unico ?? null,
                    codigoSistema: actualizado.codigo_sistema ?? null,
                    fechaEntrega: actualizado.fecha_entrega,
                    fechaRetiro: actualizado.fecha_retiro,
                    estado: actualizado.estado,
                    estadoFisico: actualizado.estado_fisico,
                    ubicacion: actualizado.ubicacion,
                    ue: actualizado.ue,
                    descripcion: actualizado.descripcion,
                    observaciones: actualizado.observaciones,
                    precio: actualizado.precio,
                },
                justificacion: datos.justificacion ?? null,
            },
        });
        return actualizado;
    }

    async eliminarActivoFijo(id: number): Promise<void> {
        const activo = await this.activoFijoRepositorio.findOne({ where: { id: Number(id) }, relations: ['items'] });
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

    async eliminarItemActivo(id: string): Promise<void> {
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        await this.itemActivoRepositorio.softRemove(item);
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: item.id,
            accion: 'eliminar',
            detalle: {
                id: item.id,
                idActivo: item.activo?.id,
                codigoInventario: item.codigo_inventario ?? null,
                codigoUnico: item.codigo_unico ?? null,
                codigoSistema: item.codigo_sistema ?? null,
            },
        });
    }
}
