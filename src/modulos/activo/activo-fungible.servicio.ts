import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActivoFungible } from './entidades/activo-fungible.entidad';
import { ItemActivoFungible } from './entidades/item-activo-fungible.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

type UsuarioAutenticado = {
    id: number;
    rol: string;
    id_inventario?: number | null;
};

type ContextoInventario = {
    esAdmin: boolean;
    idInventario: number | null;
};

@Injectable()
export class ActivoFungibleServicio {
    constructor(
        @InjectRepository(ActivoFungible)
        private readonly activoFungibleRepositorio: Repository<ActivoFungible>,
        @InjectRepository(ItemActivoFungible)
        private readonly itemActivoFungibleRepositorio: Repository<ItemActivoFungible>,
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
    ) {}

    private async resolverContextoInventario(usuario: UsuarioAutenticado): Promise<ContextoInventario & { permitidosIds?: number[] }> {
        if (usuario.rol === 'administrador') {
            return { esAdmin: true, idInventario: null, permitidosIds: [] };
        }

        if (usuario.rol !== 'encargado_inventario') {
            throw new ForbiddenException('No tienes permisos para gestionar activos.');
        }

        return {
            esAdmin: false,
            idInventario: usuario.id_inventario ?? null,
            permitidosIds: usuario.id_inventario ? [usuario.id_inventario] : [],
        };
    }

    private validarAccesoRecursoPorInventario(
        contexto: ContextoInventario,
        idInventarioRecurso: number | null,
        mensajeSinInventario: string,
        mensajeSinAcceso: string,
    ) {
        if (contexto.esAdmin) return;
        if (!contexto.idInventario) {
            throw new ForbiddenException(mensajeSinInventario);
        }
        if (!idInventarioRecurso || idInventarioRecurso !== contexto.idInventario) {
            throw new ForbiddenException(mensajeSinAcceso);
        }
    }

    async obtenerFungibles(usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        let where = {};
        if (!contexto.esAdmin) {
            if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
                const pIds = (contexto as any).permitidosIds ?? [];
                if (pIds.length === 0) return [];
                where = { inventario: { id: In(pIds) } };
            } else {
                where = { inventario: { id: contexto.idInventario as number } };
            }
        }
        const activos = await this.activoFungibleRepositorio.find({
            where,
            relations: ['items', 'inventario'],
            order: { nombre: 'ASC' },
        });
        return activos.map(a => this.serializarFungibleApi(a));
    }

    async crearActivoFungible(dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const inventarioId = contexto.esAdmin ? (dto.idInventario ?? null) : contexto.idInventario;
        const inventario = inventarioId ? await this.inventarioRepositorio.findOne({ where: { id: Number(inventarioId) } }) : null;

        const activo = this.activoFungibleRepositorio.create({
            nombre: dto.nombre,
            categoria: dto.categoria ?? 'General',
            descripcion: dto.descripcion,
            unidad_medida: dto.unidad ?? 'unidades',
            tipo_cantidad: dto.tipoCantidad ?? 'entero',
            tipo_identificacion: dto.tipoIdentificacion ?? 'solo_sistema',
            tiene_vencimiento: Boolean(dto.tieneVencimiento ?? false),
            inventario,
        });

        const guardado = await this.activoFungibleRepositorio.save(activo);
        const completo = await this.activoFungibleRepositorio.findOne({ where: { id: guardado.id }, relations: ['items', 'inventario'] });
        return this.serializarFungibleApi(completo!);
    }

    async editarActivoFungible(id: number, dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFungibleRepositorio.findOne({ where: { id }, relations: ['inventario'] });
        if (!activo) throw new NotFoundException('Activo fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para editar activos fungibles.',
            'No puedes editar activos fungibles de otro inventario.',
        );

        if (dto.nombre !== undefined) activo.nombre = dto.nombre;
        if (dto.categoria !== undefined) activo.categoria = dto.categoria;
        if (dto.descripcion !== undefined) activo.descripcion = dto.descripcion;
        if (dto.unidad !== undefined) activo.unidad_medida = dto.unidad;
        if (dto.tipoIdentificacion !== undefined) activo.tipo_identificacion = dto.tipoIdentificacion;
        if (dto.tieneVencimiento !== undefined) activo.tiene_vencimiento = Boolean(dto.tieneVencimiento);

        const guardado = await this.activoFungibleRepositorio.save(activo);
        const completo = await this.activoFungibleRepositorio.findOne({ where: { id: guardado.id }, relations: ['items', 'inventario'] });
        return this.serializarFungibleApi(completo!);
    }

    async eliminarActivoFungible(id: number, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFungibleRepositorio.findOne({ where: { id }, relations: ['items', 'inventario'] });
        if (!activo) throw new NotFoundException('Activo fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar activos fungibles.',
            'No puedes eliminar activos fungibles de otro inventario.',
        );

        if (activo.items && activo.items.length > 0) {
            await this.itemActivoFungibleRepositorio.softRemove(activo.items);
        }
        await this.activoFungibleRepositorio.softRemove(activo);
    }

    async crearItemFungible(dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const activoId = Number(dto.cajaId ?? dto.activoId);
        const activo = await this.activoFungibleRepositorio.findOne({ where: { id: activoId }, relations: ['inventario'] });
        if (!activo) throw new NotFoundException('Activo fungible principal no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para crear lotes.',
            'No puedes crear lotes en otro inventario.',
        );

        const item = this.itemActivoFungibleRepositorio.create({
            activo,
            lote: dto.lote ?? null,
            serie: dto.serie ?? null,
            cantidad: Number(dto.cantidadDisponible ?? dto.cantidad ?? 0),
            fecha_vencimiento: dto.fechaCaducidad ? new Date(dto.fechaCaducidad) : null,
            precio: Number(dto.precio ?? 0),
            observaciones: dto.observaciones ?? '',
            estado: 'disponible',
        });

        const guardado = await this.itemActivoFungibleRepositorio.save(item);
        return {
            id: guardado.id,
            tipo: activo.tipo_identificacion,
            lote: guardado.lote ?? null,
            serie: guardado.serie ?? null,
            cantidadDisponible: Number(guardado.cantidad),
            fechaCaducidad: guardado.fecha_vencimiento ? guardado.fecha_vencimiento.toISOString() : null,
            precio: Number(guardado.precio),
        };
    }

    async editarItemFungible(id: string, dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoFungibleRepositorio.findOne({ where: { id }, relations: ['activo', 'activo.inventario'] });
        if (!item) throw new NotFoundException('Item fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para editar lotes.',
            'No puedes editar lotes de otro inventario.',
        );

        if (dto.lote !== undefined) item.lote = dto.lote;
        if (dto.serie !== undefined) item.serie = dto.serie;
        if (dto.cantidadDisponible !== undefined) item.cantidad = Number(dto.cantidadDisponible);
        if (dto.cantidad !== undefined) item.cantidad = Number(dto.cantidad);
        if (dto.fechaCaducidad !== undefined) item.fecha_vencimiento = dto.fechaCaducidad ? new Date(dto.fechaCaducidad) : null;
        if (dto.precio !== undefined) item.precio = Number(dto.precio);
        if (dto.observaciones !== undefined) item.observaciones = dto.observaciones;

        const guardado = await this.itemActivoFungibleRepositorio.save(item);
        return {
            id: guardado.id,
            tipo: item.activo.tipo_identificacion,
            lote: guardado.lote ?? null,
            serie: guardado.serie ?? null,
            cantidadDisponible: Number(guardado.cantidad),
            fechaCaducidad: guardado.fecha_vencimiento ? guardado.fecha_vencimiento.toISOString() : null,
            precio: Number(guardado.precio),
        };
    }

    async eliminarItemFungible(id: string, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoFungibleRepositorio.findOne({ where: { id }, relations: ['activo', 'activo.inventario'] });
        if (!item) throw new NotFoundException('Item fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar lotes.',
            'No puedes eliminar lotes de otro inventario.',
        );

        await this.itemActivoFungibleRepositorio.softRemove(item);
    }

    private serializarFungibleApi(activo: ActivoFungible) {
        const idContenedorVirtual = `cat-${activo.categoria.toLowerCase().replace(/\s+/g, '-')}`;
        const contenedorVirtual = {
            id: idContenedorVirtual,
            nombre: activo.categoria,
            ubicacion: 'General'
        };

        return {
            id: activo.id,
            nombre: activo.nombre,
            categoria: activo.categoria,
            descripcion: activo.descripcion ?? '',
            unidad: activo.unidad_medida,
            stockMinimoHabilitado: false,
            stockMinimo: 0,
            tipoIdentificacion: activo.tipo_identificacion,
            idInventario: activo.inventario?.id ?? null,
            contenedor: contenedorVirtual,
            lotes: (activo.items ?? [])
                .filter(item => item.deleted_at === null)
                .map(item => ({
                    id: item.id,
                    tipo: activo.tipo_identificacion,
                    lote: item.lote ?? null,
                    serie: item.serie ?? null,
                    fechaEntrega: item.created_at,
                    fechaRetiro: null,
                    cantidadDisponible: Number(item.cantidad ?? 0),
                    fechaCaducidad: item.fecha_vencimiento ? item.fecha_vencimiento.toISOString() : null,
                    precio: Number(item.precio ?? 0),
                    contenedor: contenedorVirtual
                }))
        };
    }
}
