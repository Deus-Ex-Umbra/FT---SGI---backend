import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ContenedorMaterial } from './entidades/contenedor_material.entidad';
import { MaterialFungible } from './entidades/material_fungible.entidad';
import { LoteMaterial } from './entidades/lote_material.entidad';
import { MovimientoMaterial } from './entidades/movimiento_material.entidad';

@Injectable()
export class MaterialServicio {
    constructor(
        @InjectRepository(ContenedorMaterial)
        private readonly contenedorRepositorio: Repository<ContenedorMaterial>,
        @InjectRepository(MaterialFungible)
        private readonly materialRepositorio: Repository<MaterialFungible>,
        @InjectRepository(LoteMaterial)
        private readonly loteRepositorio: Repository<LoteMaterial>,
        @InjectRepository(MovimientoMaterial)
        private readonly movimientoRepositorio: Repository<MovimientoMaterial>,
    ) { }

    async obtenerContenedores(): Promise<ContenedorMaterial[]> {
        return await this.contenedorRepositorio.find({ where: { deletedAt: IsNull() }, order: { id: 'ASC' } });
    }

    async obtenerCajas(): Promise<MaterialFungible[]> {
        return await this.materialRepositorio.find({
            where: { deletedAt: IsNull() },
            relations: ['contenedor', 'lotes', 'lotes.contenedor'],
            order: { id: 'ASC' },
        });
    }

    async obtenerLotes(): Promise<LoteMaterial[]> {
        return await this.loteRepositorio.find({
            where: { deletedAt: IsNull() },
            relations: ['material', 'contenedor'],
            order: { createdAt: 'ASC' },
        });
    }

    async crearContenedor(datos: { nombre: string; ubicacion: string }): Promise<ContenedorMaterial> {
        const nombre = datos.nombre?.trim();
        const ubicacion = datos.ubicacion?.trim();
        if (!nombre || !ubicacion) {
            throw new BadRequestException('Nombre y ubicación del contenedor son obligatorios.');
        }

        const existente = await this.contenedorRepositorio
            .createQueryBuilder('cm')
            .where('cm.deleted_at IS NULL')
            .andWhere('LOWER(TRIM(cm.nombre)) = LOWER(:nombre)', { nombre })
            .andWhere('LOWER(TRIM(cm.ubicacion)) = LOWER(:ubicacion)', { ubicacion })
            .getOne();

        if (existente) return existente;

        const contenedor = this.contenedorRepositorio.create({ nombre, ubicacion });
        return this.contenedorRepositorio.save(contenedor);
    }

    async editarContenedor(
        id: number,
        datos: Partial<{ nombre: string; ubicacion: string }>,
    ): Promise<ContenedorMaterial> {
        const contenedor = await this.contenedorRepositorio.findOne({ where: { id } });
        if (!contenedor) throw new NotFoundException('Contenedor de material no encontrado.');

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            contenedor.nombre = datos.nombre.trim();
        }
        if (typeof datos.ubicacion === 'string' && datos.ubicacion.trim()) {
            contenedor.ubicacion = datos.ubicacion.trim();
        }

        const duplicado = await this.contenedorRepositorio
            .createQueryBuilder('cm')
            .where('cm.deleted_at IS NULL')
            .andWhere('cm.id <> :id', { id })
            .andWhere('LOWER(TRIM(cm.nombre)) = LOWER(:nombre)', { nombre: contenedor.nombre })
            .andWhere('LOWER(TRIM(cm.ubicacion)) = LOWER(:ubicacion)', { ubicacion: contenedor.ubicacion })
            .getOne();

        if (duplicado) {
            throw new BadRequestException('Ya existe un contenedor de material con ese nombre y ubicación.');
        }

        return this.contenedorRepositorio.save(contenedor);
    }

    async eliminarContenedor(id: number): Promise<void> {
        const contenedor = await this.contenedorRepositorio.findOne({ where: { id, deletedAt: IsNull() } });
        if (!contenedor) throw new NotFoundException('Contenedor de material no encontrado.');

        // Con el modelo nuevo, el contenedor solo afecta a instancias (items) y no elimina el catálogo (materiales padre).
        const instancias = await this.loteRepositorio.find({
            where: { contenedor: { id }, deletedAt: IsNull() },
            relations: ['material', 'contenedor'],
        });
        if (instancias.length > 0) {
            await this.loteRepositorio.softRemove(instancias);
        }

        // Desasignar cualquier material legacy que aún apunte a este contenedor.
        const materialesLegacy = await this.materialRepositorio.find({ where: { contenedor: { id }, deletedAt: IsNull() }, relations: ['contenedor'] });
        if (materialesLegacy.length > 0) {
            materialesLegacy.forEach((m) => (m.contenedor = null));
            await this.materialRepositorio.save(materialesLegacy);
        }

        await this.contenedorRepositorio.softRemove(contenedor);
    }

    async crearCaja(datos: {
        idContenedor?: number;
        nombre: string;
        categoria?: string;
        descripcion?: string;
        unidad?: string;
        stockMinimoHabilitado?: boolean;
        stockMinimo?: number;
        tipoIdentificacion?: 'lote' | 'serie' | 'simple';
    }): Promise<MaterialFungible> {
        const contenedor =
            datos.idContenedor != null
                ? await this.contenedorRepositorio.findOne({ where: { id: Number(datos.idContenedor), deletedAt: IsNull() } })
                : null;
        if (datos.idContenedor != null && !contenedor) {
            throw new NotFoundException('Contenedor de material no encontrado.');
        }

        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre de la caja es obligatorio.');
        }

        const caja = this.materialRepositorio.create({
            contenedor: contenedor ?? null,
            nombre,
            categoria: datos.categoria?.trim() || 'Fungible',
            descripcion: datos.descripcion?.trim() || '',
            unidad: datos.unidad?.trim() || 'Unidades',
            stockMinimoHabilitado: Boolean(datos.stockMinimoHabilitado),
            stockMinimo: Number(datos.stockMinimo ?? 0),
            tipoIdentificacion: datos.tipoIdentificacion ?? 'lote',
        });

        return this.materialRepositorio.save(caja);
    }

    async editarCaja(
        id: number,
        datos: Partial<{ nombre: string; categoria: string; descripcion: string; unidad: string; stockMinimoHabilitado: boolean; stockMinimo: number; tipoIdentificacion: 'lote' | 'serie' | 'simple' }>,
    ): Promise<MaterialFungible> {
        const caja = await this.materialRepositorio.findOne({ where: { id }, relations: ['contenedor'] });
        if (!caja) throw new NotFoundException('Caja/material no encontrado.');

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) caja.nombre = datos.nombre.trim();
        if (typeof datos.categoria === 'string' && datos.categoria.trim()) caja.categoria = datos.categoria.trim();
        if (typeof datos.descripcion === 'string') caja.descripcion = datos.descripcion.trim();
        if (typeof datos.unidad === 'string' && datos.unidad.trim()) caja.unidad = datos.unidad.trim();
        if (typeof datos.stockMinimoHabilitado === 'boolean') caja.stockMinimoHabilitado = datos.stockMinimoHabilitado;
        if (typeof datos.stockMinimo === 'number' && Number.isFinite(datos.stockMinimo)) {
            caja.stockMinimo = Number(datos.stockMinimo);
        }
        if (typeof datos.tipoIdentificacion === 'string' && ['lote', 'serie', 'simple'].includes(datos.tipoIdentificacion)) {
            caja.tipoIdentificacion = datos.tipoIdentificacion;
        }

        return this.materialRepositorio.save(caja);
    }

    async eliminarCaja(id: number): Promise<void> {
        const caja = await this.materialRepositorio.findOne({ where: { id }, relations: ['lotes'] });
        if (!caja) throw new NotFoundException('Caja/material no encontrado.');

        const lotes = caja.lotes ?? [];
        if (lotes.length > 0) {
            await this.loteRepositorio.softRemove(lotes);
        }
        await this.materialRepositorio.softRemove(caja);
    }

    async crearLote(datos: {
        idMaterial: number;
        idContenedor: number;
        tipo: 'lote' | 'serie' | 'simple';
        lote?: string | null;
        serie?: string | null;
        fechaEntrega?: string | null;
        fechaRetiro?: string | null;
        cantidadDisponible?: number;
        fechaCaducidad?: string | null;
        precio?: number;
    }): Promise<LoteMaterial> {
        const material = await this.materialRepositorio.findOne({ where: { id: Number(datos.idMaterial) } });
        if (!material) {
            throw new NotFoundException('Caja/material no encontrado.');
        }

        const contenedor = await this.contenedorRepositorio.findOne({ where: { id: Number(datos.idContenedor), deletedAt: IsNull() } });
        if (!contenedor) {
            throw new NotFoundException('Contenedor de material no encontrado.');
        }

        const tipo = datos.tipo;
        if (!['lote', 'serie', 'simple'].includes(tipo)) {
            throw new BadRequestException('Tipo de instancia inválido.');
        }

        const loteCodigo = (datos.lote ?? '')?.trim();
        const serieCodigo = (datos.serie ?? '')?.trim();

        if (tipo === 'lote' && !loteCodigo) throw new BadRequestException('El código de lote es obligatorio.');
        if (tipo === 'serie' && !serieCodigo) throw new BadRequestException('El código de serie es obligatorio.');

        const lote = this.loteRepositorio.create({
            material,
            contenedor,
            tipo,
            lote: tipo === 'lote' ? loteCodigo : null,
            serie: tipo === 'serie' ? serieCodigo : null,
            fechaEntrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined,
            fechaRetiro: datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined,
            cantidadDisponible: Number(datos.cantidadDisponible ?? 0),
            fechaCaducidad: datos.fechaCaducidad ? new Date(datos.fechaCaducidad) : undefined,
            precio: Number(datos.precio ?? 0),
        });

        return this.loteRepositorio.save(lote);
    }

    async editarLote(
        id: string,
        datos: Partial<{ tipo: 'lote' | 'serie' | 'simple'; lote: string | null; serie: string | null; fechaEntrega: string | null; fechaRetiro: string | null; cantidadDisponible: number; fechaCaducidad: string | null; precio: number }>,
    ): Promise<LoteMaterial> {
        const lote = await this.loteRepositorio.findOne({ where: { id }, relations: ['material', 'contenedor'] });
        if (!lote) throw new NotFoundException('Lote no encontrado.');

        if (typeof datos.tipo === 'string' && ['lote', 'serie', 'simple'].includes(datos.tipo)) {
            lote.tipo = datos.tipo;
        }

        if (datos.lote !== undefined) {
            const v = datos.lote == null ? '' : String(datos.lote);
            lote.lote = v.trim() ? v.trim() : null;
        }

        if (datos.serie !== undefined) {
            const v = datos.serie == null ? '' : String(datos.serie);
            lote.serie = v.trim() ? v.trim() : null;
        }

        if (lote.tipo === 'lote' && !String(lote.lote ?? '').trim()) {
            throw new BadRequestException('El código de lote es obligatorio.');
        }
        if (lote.tipo === 'serie' && !String(lote.serie ?? '').trim()) {
            throw new BadRequestException('El código de serie es obligatorio.');
        }
        if (lote.tipo === 'simple') {
            lote.lote = null;
            lote.serie = null;
        }

        if (datos.fechaEntrega !== undefined) lote.fechaEntrega = datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined;
        if (datos.fechaRetiro !== undefined) lote.fechaRetiro = datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined;
        if (typeof datos.cantidadDisponible === 'number' && Number.isFinite(datos.cantidadDisponible)) {
            lote.cantidadDisponible = Number(datos.cantidadDisponible);
        }
        if (datos.fechaCaducidad !== undefined) lote.fechaCaducidad = datos.fechaCaducidad ? new Date(datos.fechaCaducidad) : undefined;
        if (typeof datos.precio === 'number' && Number.isFinite(datos.precio)) lote.precio = Number(datos.precio);

        return this.loteRepositorio.save(lote);
    }

    async eliminarLote(id: string): Promise<void> {
        const lote = await this.loteRepositorio.findOne({ where: { id } });
        if (!lote) throw new NotFoundException('Lote no encontrado.');
        await this.loteRepositorio.remove(lote);
    }

    async obtenerKardexMaterial(idMaterial: number) {
        const lotes = await this.loteRepositorio.find({
            where: { material: { id: idMaterial }, deletedAt: IsNull() },
            relations: ['material'],
            order: { createdAt: 'ASC' },
        });

        if (lotes.length === 0) {
            return {
                materialId: idMaterial,
                materialNombre: null,
                movimientos: [],
            };
        }

        const idsLotes = lotes.map((l) => l.id);
        const movimientos = await this.movimientoRepositorio.find({
            where: { lote: { id: In(idsLotes) } },
            relations: ['lote', 'lote.material'],
            order: { fecha: 'ASC', id: 'ASC' },
        });

        return {
            materialId: idMaterial,
            materialNombre: lotes[0].material.nombre,
            movimientos: movimientos.map((m) => ({
                id: m.id,
                fecha: m.fecha,
                tipo: m.tipo,
                cantidad: m.cantidad,
                motivo: m.motivo,
                referencia: m.referencia ?? '',
                lote: m.lote?.lote ?? m.lote?.serie ?? '',
            })),
        };
    }
}
